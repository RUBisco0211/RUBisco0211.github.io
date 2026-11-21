import { cyan, inverse, moveTo } from '../../../render/ansi.ts'
import { markMatches, matchesQuery } from '../../../render/mark.ts'
import { padEnd, truncateTo, visibleWidth } from '../../../render/width.ts'
import { wrapAnsi } from '../../../render/wrap.ts'
import { keyChord, lookupKey, resolveKeys, type Keymap } from '../../keys.ts'
import type { Term } from '../../terminal.ts'
import { Screen } from '../screen.ts'
import { cleanSelection, locateTitles, progress } from './logic.ts'

export interface PagerLabels {
    /** 目录模式的标题，拼在文档标题后面 */
    readonly outline: string
    /** 目录模式的操作提示 */
    readonly outlineHints: readonly string[]
    /** 搜索无匹配时的状态文本 */
    readonly noMatch: (query: string) => string
    /** 浏览模式的操作提示，按重要性从低到高 */
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
    /** 标题列表，按 `t` 可以跳过去 */
    readonly outline?: readonly string[]
    /** 打开时自动搜这个词，并跳到第一个匹配（从 search 进来时用） */
    readonly focus?: string
    /** 初次跳转时从这个行号之后找匹配，用来跳过 frontmatter */
    readonly focusFrom?: number
    /** 键位覆盖，按动作替换默认值 */
    readonly keys?: Partial<Keymap<PagerAction>>
}

export type PagerAction =
    | 'quit'
    | 'cancel'
    | 'confirm'
    | 'search'
    | 'next'
    | 'prev'
    | 'outline'
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
    outline: ['t'],
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

type Mode = 'browse' | 'search' | 'outline'

/**
 * 整屏查看器：切到 alternate screen，自己画每一屏。
 *
 * 生命周期、画布、输入、列表光标、滚动视口统一由 `Screen` 持有；
 * 这里只留 pager 自己的模式状态机（browse / search / outline）。
 *
 * 视口变化时会按新宽度重新渲染并重画（alt buffer 不 reflow，必须整屏重来）。
 */
export function runPager(term: Term, input: PagerInput): Promise<void> {
    const keymap = resolveKeys(DEFAULT_KEYS, input.keys)
    const titles = input.outline ?? []

    let screen: Screen | undefined
    let lines: string[] = []
    let focusStart = 0

    let mode: Mode = 'browse'
    let query = ''
    let matches: number[] = []
    let matchIndex = -1
    let outlineAt: number[] = []

    /** pager 是否还在。复制是异步的，回来时可能已经 quit，不能再往终端写 */
    let active = true
    /** 复制提示的定时器：提示写在字符网格里，到点要把那行重画回来 */
    let toastTimer: ReturnType<typeof setTimeout> | undefined

    const height = (): number => Math.max(1, (screen?.rows ?? term.rows) - 1)

    /** 重新渲染并折行，按比例保住原来的阅读位置 */
    const rebuild = (): void => {
        if (!screen) return
        const s = screen

        const h = height()
        const previousMax = Math.max(0, lines.length - h)
        const ratio = previousMax > 0 ? s.scroll.offset / previousMax : 0

        const raw = input.render(s.cols)
        const wrapped = raw.map((line) => wrapAnsi(line, s.cols))
        lines = wrapped.flat()
        focusStart = wrapped
            .slice(0, Math.max(0, input.focusFrom ?? 0))
            .reduce((sum, chunk) => sum + chunk.length, 0)

        s.scroll.setTotal(lines.length)
        s.scroll.setHeight(h)
        s.scroll.scrollTo(Math.round(ratio * Math.max(0, lines.length - h)))

        outlineAt = locateTitles(lines, titles)
        recalcMatches()
    }

    const recalcMatches = (): void => {
        matches =
            query === '' ? [] : lines.flatMap((line, i) => (matchesQuery(line, query) ? [i] : []))
        matchIndex = matches.length > 0 ? 0 : -1
    }

    const bodyText = (row: number): string => {
        const line = lines[(screen?.scroll.offset ?? 0) + row] ?? ''
        return query === '' ? line : markMatches(line, query)
    }

    const outlineText = (row: number): string => {
        if (!screen) return ''
        const index = screen.list.offset + row
        const title = titles[index]
        if (title === undefined) return ''

        const current = index === screen.list.index
        const marker = current ? cyan('>') : ' '
        const label = current
            ? cyan(truncateTo(title, screen.cols - 4))
            : truncateTo(title, screen.cols - 4)
        return ` ${marker} ${label}`
    }

    const draw = (): void => {
        if (!screen) return
        // 重绘后 buffer 内容变了，旧选区会漂到新内容上，所以每次重画都清掉。
        // 复制流程是「先取文本、清选区、再画反馈」，顺序不能反。
        if (term.hasSelection()) term.clearSelection()

        const h = height()
        if (mode === 'outline') {
            screen.list.setTotal(titles.length)
            screen.list.setVisible(h)
            for (let row = 0; row < h; row += 1) screen.put(row, outlineText(row))
            screen.status({
                left: `${input.title} · ${input.labels.outline}`,
                right: progress(screen.list.index, Math.max(1, titles.length), 1),
                hints: input.labels.outlineHints,
            })
        } else {
            for (let row = 0; row < h; row += 1) screen.put(row, bodyText(row))
            if (mode === 'search') {
                screen.put(screen.rows - 1, inverse(padEnd(`/${screen.input.value}`, screen.cols)))
            } else {
                const extra =
                    query === ''
                        ? ''
                        : matches.length === 0
                          ? input.labels.noMatch(query)
                          : `/${query} ${matchIndex + 1}/${matches.length}`
                screen.status({
                    left: input.title,
                    right: [extra, progress(screen.scroll.offset, lines.length, h)]
                        .filter(Boolean)
                        .join('  ·  '),
                    hints: input.labels.hints,
                })
            }
        }

        screen.flush()
    }

    /**
     * 在屏幕右上角盖一条临时提示（复制结果这种），到点再把被盖住的那行重画回来。
     *
     * 内容直接写进字符网格，会盖住底下的正文；中途任何一次 draw() 也会把它冲掉。
     * 写完后把光标放回状态行末尾，不然它停在提示右边缘。
     */
    const flash = (text: string): void => {
        if (!screen) return
        const label = ` ${text} `
        const width = visibleWidth(label)
        if (width >= screen.cols) return

        screen.write(
            `${moveTo(1, screen.cols - width + 1)}${inverse(label)}${moveTo(screen.rows, screen.cols)}`,
        )

        clearTimeout(toastTimer)
        toastTimer = setTimeout(() => {
            if (!active || !screen) return
            screen.put(0, mode === 'outline' ? outlineText(0) : bodyText(0))
            screen.flush()
            screen.write(moveTo(screen.rows, screen.cols))
        }, 1200)
    }

    /** 返回是否真的滚动了（滚到头时返回 false） */
    const scrollTo = (next: number): boolean => {
        if (!screen || !screen.scroll.scrollTo(next)) return false
        draw()
        return true
    }

    /** 跳到第 index 个匹配，并把它滚到屏幕上方三分之一处 */
    const gotoMatch = (index: number): void => {
        if (matches.length === 0) return
        matchIndex = ((index % matches.length) + matches.length) % matches.length
        scrollTo(matches[matchIndex]! - Math.floor(height() / 3))
        draw()
    }

    return new Promise<void>((resolve) => {
        /** 复制当前选区，右上角提示结果 */
        const copySelection = (): void => {
            if (!term.hasSelection()) return

            const text = cleanSelection(term.getSelection())
            term.clearSelection()
            if (text === '') return

            void term.copy(text).then((ok) => {
                if (!active) return
                flash(ok ? '已复制' : '复制失败')
            })
        }

        const quit = (): void => {
            active = false
            clearTimeout(toastTimer)
            screen?.close()
            resolve()
        }

        const handleSearchKey = (event: KeyboardEvent): void => {
            switch (lookupKey(keymap, event)) {
                case 'confirm':
                    query = screen!.input.value
                    recalcMatches()
                    mode = 'browse'
                    if (matches.length > 0) {
                        gotoMatch(matches.findIndex((line) => line >= screen!.scroll.offset))
                    } else {
                        draw()
                    }
                    return
                case 'cancel':
                    mode = 'browse'
                    screen!.input.clear()
                    draw()
                    return
            }
            if (screen!.input.handle(event)) draw()
        }

        const handleOutlineKey = (event: KeyboardEvent): void => {
            switch (lookupKey(keymap, event)) {
                case 'up':
                    if (screen!.list.move(-1)) draw()
                    return
                case 'down':
                    if (screen!.list.move(1)) draw()
                    return
                case 'confirm': {
                    const target = outlineAt[screen!.list.index]
                    mode = 'browse'
                    if (target !== undefined && target >= 0) scrollTo(target)
                    draw()
                    return
                }
                case 'cancel':
                case 'quit':
                    mode = 'browse'
                    draw()
                    return
            }
        }

        const handleBrowseKey = (event: KeyboardEvent): void => {
            switch (lookupKey(keymap, event)) {
                case 'quit':
                    quit()
                    return
                case 'cancel':
                    // 有选区先清选区，再清搜索，最后才退出
                    if (term.hasSelection()) {
                        term.clearSelection()
                        return
                    }
                    if (query !== '') {
                        query = ''
                        matches = []
                        matchIndex = -1
                        draw()
                        return
                    }
                    quit()
                    return
                case 'copy':
                    copySelection()
                    return
                case 'search':
                    mode = 'search'
                    screen!.input.set(query)
                    draw()
                    return
                case 'next':
                    if (matches.length > 0) gotoMatch(matchIndex + 1)
                    return
                case 'prev':
                    if (matches.length > 0) gotoMatch(matchIndex - 1)
                    return
                case 'outline':
                    if (titles.length > 0) {
                        mode = 'outline'
                        screen!.list.reset()
                        screen!.list.setTotal(titles.length)
                        draw()
                    }
                    return
                case 'down':
                    if (screen!.scroll.scrollBy(1)) draw()
                    return
                case 'up':
                    if (screen!.scroll.scrollBy(-1)) draw()
                    return
                case 'pageDown':
                    if (screen!.scroll.pageDown()) draw()
                    return
                case 'pageUp':
                    if (screen!.scroll.pageUp()) draw()
                    return
                case 'halfDown':
                    if (screen!.scroll.halfDown()) draw()
                    return
                case 'halfUp':
                    if (screen!.scroll.halfUp()) draw()
                    return
                case 'top':
                    if (screen!.scroll.top()) draw()
                    return
                case 'bottom':
                    if (screen!.scroll.bottom()) draw()
                    return
            }
        }

        screen = new Screen(term, {
            onKey: (event) => {
                // 带修饰键的复制快捷键（⌘C / Ctrl+Shift+C）在三个模式下都生效，
                // 否则搜索/目录模式会把组合键吞掉。裸键位（y）不在这里拦，
                // 否则搜索模式里的 y 就打不出来了
                const chord = keyChord(event)
                if (chord !== event.key && lookupKey(keymap, event) === 'copy') {
                    copySelection()
                    return
                }
                if (mode === 'search') handleSearchKey(event)
                else if (mode === 'outline') handleOutlineKey(event)
                else handleBrowseKey(event)
            },
            onWheel: (deltaY, deltaMode) => {
                if (mode !== 'browse') return
                if (screen!.scroll.wheel(deltaY, deltaMode)) draw()
            },
            onResize: () => {
                rebuild()
                draw()
            },
        })

        rebuild()

        // 从 search 跳过来时，直接定位到关键词第一次出现的位置（跳过 frontmatter）
        if (input.focus !== undefined && input.focus.trim() !== '') {
            query = input.focus
            recalcMatches()
            const first = matches.findIndex((line) => line >= focusStart)
            if (first >= 0) {
                matchIndex = first
                screen.scroll.scrollTo(matches[first]! - Math.floor(height() / 3))
            }
        }

        draw()
    })
}
