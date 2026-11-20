import {
    ALT_SCREEN_OFF,
    ALT_SCREEN_ON,
    CLEAR_SCREEN,
    ERASE_LINE,
    cyan,
    inverse,
    moveTo,
} from '../../render/ansi.ts'
import { markMatches, matchesQuery } from '../../render/mark.ts'
import { clampWindow } from '../select.ts'
import { keyChord, lookupKey, resolveKeys, type Keymap } from '../keys.ts'
import type { Term } from '../terminal.ts'
import { padEnd, truncateTo, visibleWidth } from '../../render/width.ts'
import {
    clampOffset,
    cleanSelection,
    createWheelAccumulator,
    locateTitles,
    pagerStatus,
} from './logic.ts'
import { wrapAnsi } from '../../render/wrap.ts'

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
 * 不用 DOM overlay，内容直接写进 xterm。退出时 alt screen 还原，
 * 之前的 scrollback 完好无损。
 *
 * 视口变化时会按新宽度重新渲染并重画（alt buffer 不 reflow，必须整屏重来）。
 */
export function runPager(term: Term, input: PagerInput): Promise<void> {
    const keymap = resolveKeys(DEFAULT_KEYS, input.keys)
    let cols = term.cols
    let rows = term.rows
    let height = Math.max(1, rows - 1)

    let lines: string[] = []
    let offset = 0
    /** 正文首行在折行后的下标，focus 跳转时跳过 frontmatter */
    let focusStart = 0

    let mode: Mode = 'browse'
    let query = ''
    let typing = ''
    let matches: number[] = []
    let matchIndex = -1

    const titles = input.outline ?? []
    let outlineAt: number[] = []
    let outlineCursor = 0
    let outlineOffset = 0

    /** pager 是否还在。复制是异步的，回来时可能已经 quit，不能再往终端写 */
    let active = true

    /** 复制提示的定时器：提示写在字符网格里，到点要把那行重画回来 */
    let toastTimer: ReturnType<typeof setTimeout> | undefined

    /** 重新渲染并折行，按比例保住原来的阅读位置 */
    const rebuild = (): void => {
        const previousMax = Math.max(0, lines.length - height)
        const ratio = previousMax > 0 ? offset / previousMax : 0

        const raw = input.render(cols)
        const wrapped = raw.map((line) => wrapAnsi(line, cols))
        lines = wrapped.flat()
        focusStart = wrapped
            .slice(0, Math.max(0, input.focusFrom ?? 0))
            .reduce((sum, chunk) => sum + chunk.length, 0)

        offset = clampOffset(
            Math.round(ratio * Math.max(0, lines.length - height)),
            lines.length,
            height,
        )

        outlineAt = locateTitles(lines, titles)
        recalcMatches()
    }

    const recalcMatches = (): void => {
        matches =
            query === '' ? [] : lines.flatMap((line, i) => (matchesQuery(line, query) ? [i] : []))
        matchIndex = matches.length > 0 ? 0 : -1
    }

    const drawBodyRow = (row: number): string => {
        const line = lines[offset + row] ?? ''
        const shown = query === '' ? line : markMatches(line, query)
        return `${moveTo(row + 1)}${ERASE_LINE}${shown}`
    }

    const drawBody = (): string[] => {
        const parts: string[] = []
        for (let row = 0; row < height; row += 1) parts.push(drawBodyRow(row))
        return parts
    }

    const drawOutlineRow = (row: number): string => {
        const index = outlineOffset + row
        const title = titles[index]
        if (title === undefined) return `${moveTo(row + 1)}${ERASE_LINE}`

        const current = index === outlineCursor
        const marker = current ? cyan('>') : ' '
        const label = current ? cyan(truncateTo(title, cols - 4)) : truncateTo(title, cols - 4)
        return `${moveTo(row + 1)}${ERASE_LINE} ${marker} ${label}`
    }

    const drawOutline = (): string[] => {
        outlineOffset = clampWindow(outlineCursor, outlineOffset, height)
        const parts: string[] = []
        for (let row = 0; row < height; row += 1) parts.push(drawOutlineRow(row))
        return parts
    }

    const statusLine = (): string => {
        if (mode === 'search') return inverse(padEnd(`/${typing}`, cols))
        if (mode === 'outline') {
            return pagerStatus({
                title: `${input.title} · ${input.labels.outline}`,
                offset: outlineCursor,
                total: Math.max(1, titles.length),
                height: 1,
                cols,
                hints: input.labels.outlineHints,
            })
        }
        const extra =
            query === ''
                ? ''
                : matches.length === 0
                  ? input.labels.noMatch(query)
                  : `/${query} ${matchIndex + 1}/${matches.length}`

        return pagerStatus({
            title: input.title,
            offset,
            total: lines.length,
            height,
            cols,
            extra,
            hints: input.labels.hints,
        })
    }

    const draw = (): void => {
        // 重绘后 buffer 内容变了，旧选区会漂到新内容上，所以每次重画都清掉。
        // 复制流程是「先取文本、清选区、再画反馈」，顺序不能反。
        if (term.hasSelection()) term.clearSelection()

        const parts = mode === 'outline' ? drawOutline() : drawBody()
        parts.push(`${moveTo(rows)}${ERASE_LINE}${statusLine()}`)
        term.write(parts.join(''))
    }

    /**
     * 在屏幕右上角盖一条临时提示（复制结果这种），到点再把被盖住的那行重画回来。
     *
     * 内容直接写进字符网格，会盖住底下的正文；中途任何一次 draw() 也会把它冲掉。
     * 写完后把光标放回状态行末尾，不然它停在提示右边缘。
     */
    const flash = (text: string): void => {
        const label = ` ${text} `
        const width = visibleWidth(label)
        if (width >= cols) return

        term.write(`${moveTo(1, cols - width + 1)}${inverse(label)}${moveTo(rows, cols)}`)

        clearTimeout(toastTimer)
        toastTimer = setTimeout(() => {
            if (!active) return
            const row = mode === 'outline' ? drawOutlineRow(0) : drawBodyRow(0)
            term.write(`${row}${moveTo(rows, cols)}`)
        }, 1200)
    }

    /** 返回是否真的滚动了（滚到头时返回 false） */
    const scrollTo = (next: number): boolean => {
        const clamped = clampOffset(next, lines.length, height)
        if (clamped === offset) return false
        offset = clamped
        draw()
        return true
    }

    /** 跳到第 index 个匹配，并把它滚到屏幕上方三分之一处 */
    const gotoMatch = (index: number): void => {
        if (matches.length === 0) return
        matchIndex = ((index % matches.length) + matches.length) % matches.length
        scrollTo(matches[matchIndex]! - Math.floor(height / 3))
        draw()
    }

    rebuild()

    // 从 search 跳过来时，直接定位到关键词第一次出现的位置（跳过 frontmatter）
    if (input.focus !== undefined && input.focus.trim() !== '') {
        query = input.focus
        recalcMatches()
        const first = matches.findIndex((line) => line >= focusStart)
        if (first >= 0) {
            matchIndex = first
            offset = clampOffset(matches[first]! - Math.floor(height / 3), lines.length, height)
        }
    }

    term.write(`${ALT_SCREEN_ON}${CLEAR_SCREEN}`)
    draw()

    // 视口变了就重排。xterm 的 alt buffer 不会 reflow，所以必须整屏重画
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const releaseResize = term.onResize(() => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
            cols = term.cols
            rows = term.rows
            height = Math.max(1, rows - 1)
            rebuild()
            draw()
        }, 80)
    })

    return new Promise<void>((resolve) => {
        const wheel = createWheelAccumulator()

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
            clearTimeout(resizeTimer)
            releaseResize()
            release()
            term.write(ALT_SCREEN_OFF)
            resolve()
        }

        const handleSearchKey = (event: KeyboardEvent): boolean => {
            switch (lookupKey(keymap, event)) {
                case 'confirm':
                    query = typing
                    recalcMatches()
                    mode = 'browse'
                    if (matches.length > 0) gotoMatch(matches.findIndex((line) => line >= offset))
                    else draw()
                    return true
                case 'cancel':
                    mode = 'browse'
                    typing = ''
                    draw()
                    return true
            }
            if (event.key === 'Backspace') {
                typing = typing.slice(0, -1)
                draw()
                return true
            }
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                typing += event.key
                draw()
                return true
            }
            return true
        }

        const handleOutlineKey = (event: KeyboardEvent): boolean => {
            switch (lookupKey(keymap, event)) {
                case 'up':
                    outlineCursor = Math.max(0, outlineCursor - 1)
                    draw()
                    return true
                case 'down':
                    outlineCursor = Math.min(titles.length - 1, outlineCursor + 1)
                    draw()
                    return true
                case 'confirm': {
                    const target = outlineAt[outlineCursor]
                    mode = 'browse'
                    if (target !== undefined && target >= 0) scrollTo(target)
                    draw()
                    return true
                }
                case 'cancel':
                case 'quit':
                    mode = 'browse'
                    draw()
                    return true
            }
            return true
        }

        const handleBrowseKey = (event: KeyboardEvent): boolean => {
            switch (lookupKey(keymap, event)) {
                case 'quit':
                    quit()
                    return true
                case 'cancel':
                    // 有选区先清选区，再清搜索，最后才退出
                    if (term.hasSelection()) {
                        term.clearSelection()
                        return true
                    }
                    if (query !== '') {
                        query = ''
                        matches = []
                        matchIndex = -1
                        draw()
                        return true
                    }
                    quit()
                    return true
                case 'copy':
                    copySelection()
                    return true
                case 'search':
                    mode = 'search'
                    typing = query
                    draw()
                    return true
                case 'next':
                    if (matches.length > 0) gotoMatch(matchIndex + 1)
                    return true
                case 'prev':
                    if (matches.length > 0) gotoMatch(matchIndex - 1)
                    return true
                case 'outline':
                    if (titles.length > 0) {
                        mode = 'outline'
                        outlineCursor = 0
                        outlineOffset = 0
                        draw()
                    }
                    return true
                case 'down':
                    scrollTo(offset + 1)
                    return true
                case 'up':
                    scrollTo(offset - 1)
                    return true
                case 'pageDown':
                    scrollTo(offset + height)
                    return true
                case 'pageUp':
                    scrollTo(offset - height)
                    return true
                case 'halfDown':
                    scrollTo(offset + Math.floor(height / 2))
                    return true
                case 'halfUp':
                    scrollTo(offset - Math.floor(height / 2))
                    return true
                case 'top':
                    scrollTo(0)
                    return true
                case 'bottom':
                    scrollTo(lines.length)
                    return true
            }
            return true
        }

        const release = term.captureKeys(
            (event) => {
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
            (deltaY, deltaMode) => {
                if (mode !== 'browse') return
                const step = wheel.next(deltaY, deltaMode)
                if (step === 0) return
                // 滚到头了就把攒着的小数丢掉，免得反向时先空转
                if (!scrollTo(offset + step)) wheel.reset()
            },
        )
    })
}
