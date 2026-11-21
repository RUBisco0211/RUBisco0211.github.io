import { inverse } from '@/render/ansi.ts'
import { markMatches, matchesQuery } from '@/render/mark.ts'
import { padEnd } from '@/render/width.ts'
import { wrapAnsi } from '@/render/wrap.ts'
import type { TuiDriver } from '@/term/driver.ts'
import { keyChord, lookupKey, resolveKeys, type Keymap } from '@/term/keys.ts'
import type { Canvas } from '@/tui/canvas.ts'
import { Scroll } from '@/tui/components/scroll.ts'
import { TextInput } from '@/tui/components/text-input.ts'
import { TuiSession, type FlashOptions } from '@/tui/session.ts'
import type { TuiView } from '@/tui/view.ts'

export interface PagerLabels {
    /** 搜索无匹配时的状态文本 */
    readonly noMatch: (query: string) => string
    /** 浏览视图的操作提示，按重要性从低到高 */
    readonly hints?: readonly string[]
}

export interface PagerInput {
    readonly title: string
    readonly labels: PagerLabels
    /**
     * 给定列宽产出未折行的内容（可含 ANSI）。
     * 折行由 pager 自己做，所以视口变宽变窄时只要重新调一次这个函数。
     */
    readonly render: (cols: number) => readonly string[]
    /** 打开时自动搜这个词，并跳到第一个匹配（从 search 进来时用） */
    readonly focus?: string
    /** 初次跳转时从这个行号之后找匹配，用来跳过 frontmatter */
    readonly focusFrom?: number
    /** 键位覆盖，按动作替换默认值 */
    readonly keys?: Partial<Keymap<PagerAction>>
    /**
     * 额外的按键处理：浏览模式下、默认动作都没命中时调用（键位写法同 keys）。
     * 目录这类上层功能挂在这里，pager 本身不认识它们。
     */
    readonly bindings?: Readonly<Record<string, (view: PagerView, session: TuiSession) => void>>
    /** 复制提示的位置/时长/样式 */
    readonly flash?: FlashOptions
}

export type PagerAction =
    | 'quit'
    | 'cancel'
    | 'confirm'
    | 'search'
    | 'next'
    | 'prev'
    | 'down'
    | 'up'
    | 'pageDown'
    | 'pageUp'
    | 'halfDown'
    | 'halfUp'
    | 'top'
    | 'bottom'
    | 'copy'

/** 默认键位只在组件内部用，调用方只传覆盖项 */
const DEFAULT_KEYS: Keymap<PagerAction> = {
    quit: ['q'],
    cancel: ['Escape'],
    confirm: ['Enter'],
    search: ['/'],
    next: ['n'],
    prev: ['N'],
    down: ['j', 'ArrowDown'],
    up: ['k', 'ArrowUp'],
    pageDown: [' ', 'f', 'PageDown'],
    pageUp: ['b', 'PageUp'],
    halfDown: ['d'],
    halfUp: ['u'],
    top: ['g', 'Home'],
    bottom: ['G', 'End'],
    copy: ['y', 'ctrl+c', 'ctrl+shift+c', 'meta+c'],
}

/** 纯逻辑：选区清理、进度文本。无状态，可直接单测。 */
/**
 * 把 xterm 的选区文本整理成适合粘贴的样子。
 *
 * buffer 的每一行是空格填充的，选到行尾会带一串空白；选区结束在空行时
 * 末尾还会剩几个换行。段落之间的空行要保留，所以只去行尾空白和末尾换行。
 */
export function cleanSelection(text: string): string {
    return text
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n+$/, '')
}

/** 底部状态栏右边的进度文本：`10%  ·  1-10/100` */
export function progress(offset: number, total: number, height: number): string {
    const percent = Math.min(
        100,
        total <= height ? 100 : Math.round(((offset + height) / total) * 100),
    )
    const position = `${offset + 1}-${Math.min(offset + height, total)}/${total}`
    return `${percent}%  ·  ${position}`
}

/**
 * 阅读视图：一个 class 装下正文、滚动、搜索输入。
 *
 * 浏览和搜索是它的两个模式（`searching`），共享正文和 `scroll`，只差底部一行和键路由。
 * 它只认识「正文、跳转、搜索、复制」这些通用阅读能力，不认识目录/标题这类上层功能；
 * 上层通过 `bindings` 追加键位，用 `renderedLines()` + `jumpTo()` 自己实现定位。
 */
export class PagerView implements TuiView {
    readonly done: Promise<void>

    private readonly input: PagerInput
    private readonly keymap: ReadonlyMap<string, PagerAction>
    private readonly scroll: Scroll
    private readonly search = new TextInput()

    private lines: string[] = []
    private focusStart = 0
    private renderedCols = 0
    private viewHeight = 1
    private focusApplied = false
    private query = ''
    private matches: number[] = []
    private matchIndex = -1
    private searching = false

    private resolve!: () => void

    constructor(input: PagerInput) {
        this.input = input
        this.keymap = resolveKeys(DEFAULT_KEYS, input.keys)
        this.scroll = new Scroll({ height: 1 })
        this.done = new Promise<void>((resolve) => {
            this.resolve = resolve
        })
    }

    draw(canvas: Canvas): void {
        const h = Math.max(1, canvas.rows - 1)
        if (canvas.cols !== this.renderedCols) {
            this.rebuild(canvas.cols, canvas.rows)
        } else {
            this.viewHeight = h
            this.scroll.setHeight(h)
        }

        // 首帧能拿到尺寸后再定位 focus
        if (!this.focusApplied) {
            this.focusApplied = true
            this.applyFocus()
        }

        for (let row = 0; row < h; row += 1) canvas.put(row, this.bodyText(row))

        if (this.searching) {
            canvas.put(canvas.rows - 1, inverse(padEnd(`/${this.search.value}`, canvas.cols)))
        } else {
            const extra =
                this.query === ''
                    ? ''
                    : this.matches.length === 0
                      ? this.input.labels.noMatch(this.query)
                      : `/${this.query} ${this.matchIndex + 1}/${this.matches.length}`
            canvas.status({
                left: this.input.title,
                right: [extra, progress(this.scroll.offset, this.lines.length, h)]
                    .filter(Boolean)
                    .join('  ·  '),
                hints: this.input.labels.hints,
            })
        }
    }

    key(event: KeyboardEvent, session: TuiSession): void {
        // 带修饰键的复制组合在所有模式下都生效，先于模式分发
        const chord = keyChord(event)
        if (chord !== event.key && lookupKey(this.keymap, event) === 'copy') {
            this.copySelection(session)
            return
        }
        if (this.searching) this.handleSearchKey(event)
        else this.handleBrowseKey(event, session)
    }

    wheel(deltaY: number, deltaMode: number): void {
        if (this.searching) return
        this.scroll.wheel(deltaY, deltaMode)
    }

    /** 渲染并折行后的行（只读快照），给上层做定位用 */
    renderedLines(): readonly string[] {
        return this.lines
    }

    /** 滚到渲染后的第 line 行（放到视口上三分之一处） */
    jumpTo(line: number): void {
        this.scroll.scrollTo(line - Math.floor(this.viewHeight / 3))
    }

    /** 首帧定位：跳到 focus 第一次出现的位置（跳过 frontmatter） */
    private applyFocus(): void {
        if (this.input.focus === undefined || this.input.focus.trim() === '') return

        this.query = this.input.focus
        this.recalcMatches()
        const first = this.matches.findIndex((line) => line >= this.focusStart)
        if (first >= 0) {
            this.matchIndex = first
            this.scroll.scrollTo(this.matches[first]! - Math.floor(this.viewHeight / 3))
        }
    }

    /** 重新渲染并折行，按比例保住原来的阅读位置 */
    private rebuild(cols: number, rows: number): void {
        const h = Math.max(1, rows - 1)
        const previousMax = Math.max(0, this.lines.length - h)
        const ratio = previousMax > 0 ? this.scroll.offset / previousMax : 0

        const wrapped = this.input.render(cols).map((line) => wrapAnsi(line, cols))
        this.lines = wrapped.flat()
        this.focusStart = wrapped
            .slice(0, Math.max(0, this.input.focusFrom ?? 0))
            .reduce((sum, chunk) => sum + chunk.length, 0)

        this.scroll.setTotal(this.lines.length)
        this.scroll.setHeight(h)
        this.scroll.scrollTo(Math.round(ratio * Math.max(0, this.lines.length - h)))

        this.recalcMatches()
        this.renderedCols = cols
        this.viewHeight = h
    }

    private recalcMatches(): void {
        this.matches =
            this.query === ''
                ? []
                : this.lines.flatMap((line, i) => (matchesQuery(line, this.query) ? [i] : []))
        this.matchIndex = this.matches.length > 0 ? 0 : -1
    }

    private bodyText(row: number): string {
        const line = this.lines[this.scroll.offset + row] ?? ''
        return this.query === '' ? line : markMatches(line, this.query)
    }

    /** 跳到第 index 个匹配，并把它滚到屏幕上方三分之一处 */
    private gotoMatch(index: number): void {
        if (this.matches.length === 0) return
        this.matchIndex =
            ((index % this.matches.length) + this.matches.length) % this.matches.length
        this.jumpTo(this.matches[this.matchIndex]!)
    }

    private copySelection(session: TuiSession): void {
        if (!session.hasSelection()) return

        const text = cleanSelection(session.getSelection())
        session.clearSelection()
        if (text === '') return

        void session.copy(text).then((ok) => {
            session.flash(ok ? '已复制' : '复制失败', this.input.flash)
        })
    }

    private handleSearchKey(event: KeyboardEvent): void {
        switch (lookupKey(this.keymap, event)) {
            case 'confirm':
                this.query = this.search.value
                this.recalcMatches()
                this.searching = false
                if (this.matches.length > 0) {
                    this.gotoMatch(this.matches.findIndex((line) => line >= this.scroll.offset))
                }
                return
            case 'cancel':
                this.searching = false
                this.search.clear()
                return
        }
        this.search.handle(event)
    }

    private handleBrowseKey(event: KeyboardEvent, session: TuiSession): void {
        switch (lookupKey(this.keymap, event)) {
            case 'quit':
                this.resolve()
                return
            case 'cancel':
                // 有选区先清选区，再清搜索，最后才退出
                if (session.hasSelection()) {
                    session.clearSelection()
                    return
                }
                if (this.query !== '') {
                    this.query = ''
                    this.matches = []
                    this.matchIndex = -1
                    return
                }
                this.resolve()
                return
            case 'copy':
                this.copySelection(session)
                return
            case 'search':
                this.searching = true
                this.search.set(this.query)
                return
            case 'next':
                if (this.matches.length > 0) this.gotoMatch(this.matchIndex + 1)
                return
            case 'prev':
                if (this.matches.length > 0) this.gotoMatch(this.matchIndex - 1)
                return
            case 'down':
                this.scroll.scrollBy(1)
                return
            case 'up':
                this.scroll.scrollBy(-1)
                return
            case 'pageDown':
                this.scroll.pageDown()
                return
            case 'pageUp':
                this.scroll.pageUp()
                return
            case 'halfDown':
                this.scroll.halfDown()
                return
            case 'halfUp':
                this.scroll.halfUp()
                return
            case 'top':
                this.scroll.top()
                return
            case 'bottom':
                this.scroll.bottom()
                return
        }

        // 默认动作都没命中时，才轮到命令层挂的额外键位
        this.input.bindings?.[keyChord(event)]?.(this, session)
    }
}

/** 开一次会话，挂上 pager 视图，退出时关闭。 */
export async function runPager(driver: TuiDriver, input: PagerInput): Promise<void> {
    const session = new TuiSession(driver)
    const view = new PagerView(input)
    session.open(view)
    return view.done.finally(() => session.close())
}
