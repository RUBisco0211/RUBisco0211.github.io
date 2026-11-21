import { bold, cyan, dim } from '@/render/ansi.ts'
import type { TuiDriver } from '@/term/driver.ts'
import { lookupKey, resolveKeys, type Keymap } from '@/term/keys.ts'
import type { Canvas } from '@/tui/canvas.ts'
import { ListCursor } from '@/tui/components/list.ts'
import { WheelLines } from '@/tui/components/scroll.ts'
import { TextInput } from '@/tui/components/text-input.ts'
import { TuiSession } from '@/tui/session.ts'
import type { TuiView } from '@/tui/view.ts'

export interface SelectItem<T> {
    readonly value: T
    readonly label: string
    readonly detail?: string
}

export type SelectAction = 'up' | 'down' | 'confirm' | 'cancel'

/** 默认键位只在组件内部用，调用方只传覆盖项 */
const DEFAULT_KEYS: Keymap<SelectAction> = {
    up: ['ArrowUp', 'k'],
    down: ['ArrowDown', 'j'],
    confirm: ['Enter'],
    cancel: ['Escape', 'q'],
}

export interface SelectLabels {
    /** 列表为空时底部的占位文本 */
    readonly empty: string
    /** 底部操作提示，文案由调用方按自己的键位写 */
    readonly footer: string
}

export interface SelectOptions<T> {
    readonly title: string
    readonly labels: SelectLabels
    /** 允许输入关键字筛选（打开后 Esc 才是唯一取消键，q 变成普通字符） */
    readonly filterable?: boolean
    readonly items: readonly SelectItem<T>[]
    readonly hint?: string
    /** 初始选中项 */
    readonly initial?: number
    /** 光标移动时回调，用来做实时预览 */
    readonly onHighlight?: (item: SelectItem<T>, index: number) => void
    /** 确认时、弹栈前回调，父视图可以在这里处理选中的值 */
    readonly onConfirm?: (value: T) => void
    /** 键位覆盖，按动作替换默认值 */
    readonly keys?: Partial<Keymap<SelectAction>>
}

/** 按 label + detail 做子串筛选，忽略大小写 */
export function filterItems<T>(
    items: readonly SelectItem<T>[],
    query: string,
): readonly SelectItem<T>[] {
    const needle = query.trim().toLowerCase()
    if (needle === '') return items
    return items.filter((item) =>
        `${item.label} ${item.detail ?? ''}`.toLowerCase().includes(needle),
    )
}

/**
 * 列表选择视图。
 *
 * 只依赖自己的 options：`draw` 画画布，`key` 收键；确认/取消时 `done` resolve，
 * 由会话弹栈（或关闭）。视图不持有屏幕，也不知道自己上面还有没有别的视图。
 */
export class SelectView<T> implements TuiView {
    readonly done: Promise<T | undefined>

    private readonly options: SelectOptions<T>
    private readonly keymap: ReadonlyMap<string, SelectAction>
    private readonly list: ListCursor
    private readonly filter = new TextInput()
    private readonly wheelLines = new WheelLines()
    private items: readonly SelectItem<T>[]

    private settle!: (value: T | undefined) => void

    constructor(options: SelectOptions<T>) {
        this.options = options
        this.keymap = resolveKeys(DEFAULT_KEYS, options.keys)
        this.items = options.items
        this.list = new ListCursor({
            total: options.items.length,
            visible: 1,
            initial: options.initial,
        })
        this.done = new Promise<T | undefined>((resolve) => {
            this.settle = resolve
        })
        this.highlight()
    }

    draw(canvas: Canvas): void {
        this.list.setTotal(this.items.length)
        this.list.setVisible(Math.max(1, canvas.rows - 3))

        const heading =
            this.filter.value === ''
                ? this.options.title
                : `${this.options.title} · ${this.filter.value}`
        const hint = this.options.hint ? dim(this.options.hint) : ''
        canvas.put(0, `${bold(heading)}${hint ? `  ${hint}` : ''}`)

        for (let line = 0; line < this.list.visible; line += 1) {
            const item = this.items[this.list.offset + line]
            if (!item) {
                canvas.clear(line + 1)
                continue
            }
            const active = this.list.offset + line === this.list.index
            const marker = active ? cyan('>') : ' '
            const label = active ? cyan(item.label) : item.label
            const detail = item.detail ? `  ${dim(item.detail)}` : ''
            canvas.put(line + 1, ` ${marker} ${label}${detail}`)
        }

        const position =
            this.items.length === 0
                ? this.options.labels.empty
                : `${this.list.index + 1}/${this.items.length}`
        canvas.put(canvas.rows - 1, dim(`${position}　${this.options.labels.footer}`))
    }

    /** 滚轮上下移动选中项（ListCursor 会让它一直在视口里） */
    wheel(deltaY: number, deltaMode: number): void {
        const lines = this.wheelLines.take(deltaY, deltaMode)
        if (lines === 0) return
        if (this.list.move(lines)) this.highlight()
    }

    key(event: KeyboardEvent): void {
        // 可筛选时，可打印字符先给筛选框（j/k/q 也不例外）
        if (this.options.filterable && this.filter.handle(event)) {
            this.items = filterItems(this.options.items, this.filter.value)
            this.list.reset()
            this.highlight()
            return
        }

        switch (lookupKey(this.keymap, event)) {
            case 'confirm': {
                const picked = this.items[this.list.index]
                if (picked) this.options.onConfirm?.(picked.value)
                this.settle(picked?.value)
                return
            }
            case 'cancel':
                this.settle(undefined)
                return
            case 'up':
                if (this.list.move(-1)) this.highlight()
                return
            case 'down':
                if (this.list.move(1)) this.highlight()
                return
        }
    }

    private highlight(): void {
        const item = this.items[this.list.index]
        if (item) this.options.onHighlight?.(item, this.list.index)
    }
}

/**
 * 独立模态：开一次会话，挂上列表视图，选完会话关闭。
 * 命令只需要这一个入口，不接触 alt screen / 输入锁 / resize。
 */
export async function select<T>(
    driver: TuiDriver,
    options: SelectOptions<T>,
): Promise<T | undefined> {
    if (options.items.length === 0) return undefined

    const session = new TuiSession(driver)
    const view = new SelectView(options)
    session.open(view)
    return view.done.finally(() => session.close())
}
