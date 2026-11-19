import { inverse } from './ansi.ts'
import { markMatches, matchesQuery } from './mark.ts'
import { clampWindow } from './select.ts'
import type { Term } from './terminal.ts'
import { padEnd, stripAnsi, truncateTo, visibleWidth } from './width.ts'
import { wrapAnsi } from './wrap.ts'

export interface PagerInput {
    readonly title: string
    /**
     * 给定列宽产出未折行的内容（可含 ANSI）。
     * 折行由 pager 自己做，所以视口变宽变窄时只要重新调一次这个函数。
     */
    readonly render: (cols: number) => readonly string[]
    /** 标题列表，按 `t` 可以跳过去 */
    readonly outline?: readonly string[]
}

const ALT_SCREEN_ON = '\x1b[?1049h'
const ALT_SCREEN_OFF = '\x1b[?1049l'

/** 多少像素算一行。鼠标滚轮一格约 100px，所以一格 ≈ 1.25 行 */
const PIXELS_PER_LINE = 80

type Mode = 'browse' | 'search' | 'outline'

export function clampOffset(offset: number, total: number, height: number): number {
    const max = Math.max(0, total - height)
    return Math.min(Math.max(offset, 0), max)
}

/**
 * 滚轮 delta 换算成行数（可以是小数）。
 * deltaMode: 0 = 像素（触控板/平滑滚动），1 = 行，2 = 页。
 */
export function wheelLines(deltaY: number, deltaMode = 0, pixelsPerLine = PIXELS_PER_LINE): number {
    if (deltaY === 0) return 0
    if (deltaMode === 1) return deltaY
    if (deltaMode === 2) return deltaY * 10
    return deltaY / pixelsPerLine
}

export interface WheelAccumulator {
    /** 返回攒够的整数行数，不足一行返回 0 */
    next(deltaY: number, deltaMode?: number): number
    /** 丢掉攒着的小数（滚到头时用，免得反向先空转） */
    reset(): void
}

export function createWheelAccumulator(pixelsPerLine = PIXELS_PER_LINE): WheelAccumulator {
    // 按像素累加而不是按行累加：0.1 加十次不等于 1.0，攒够一行会失败
    let pixels = 0
    return {
        next(deltaY, deltaMode = 0) {
            pixels += deltaMode === 0 ? deltaY : wheelLines(deltaY, deltaMode) * pixelsPerLine
            const whole = Math.trunc(pixels / pixelsPerLine)
            pixels -= whole * pixelsPerLine
            return whole
        },
        reset() {
            pixels = 0
        },
    }
}

/**
 * 把标题映射到渲染后的行号。
 *
 * 渲染器不返回"第几行是标题"，所以这里按文字匹配：同一批标题顺序向后找，
 * 这样重复的标题也能各自对上（不会都指到第一个）。
 */
export function locateTitles(lines: readonly string[], titles: readonly string[]): number[] {
    const found: number[] = []
    let cursor = 0

    for (const title of titles) {
        const needle = title.trim().toLowerCase()
        let hit = -1

        if (needle !== '') {
            for (let i = cursor; i < lines.length; i += 1) {
                if (
                    stripAnsi(lines[i] ?? '')
                        .trim()
                        .toLowerCase()
                        .startsWith(needle)
                ) {
                    hit = i
                    break
                }
            }
        }

        found.push(hit)
        if (hit >= 0) cursor = hit + 1
    }

    return found
}

export interface StatusOptions {
    readonly title: string
    readonly offset: number
    readonly total: number
    readonly height: number
    readonly cols: number
    /** 进度前面附加的状态（比如搜索关键字和匹配数） */
    readonly extra?: string
    /** 操作提示，**按重要性从低到高**排列：放不下时从头部丢，最后一个留到最后 */
    readonly hints?: readonly string[]
}

/** 底部状态栏：左边标题，右边进度和操作提示，整行反显 */
export function pagerStatus(options: StatusOptions): string {
    const { title, offset, total, height, cols } = options
    const percent = Math.min(
        100,
        total <= height ? 100 : Math.round(((offset + height) / total) * 100),
    )
    const position = `${offset + 1}-${Math.min(offset + height, total)}/${total}`

    // 默认至少留一条退出的提示
    const hints = [...(options.hints ?? ['q 退出'])]
    const buildRight = (): string =>
        [options.extra, `${percent}%  ·  ${position}`, ...hints].filter(Boolean).join('  ·  ')

    // 挤不下就先丢最不重要的提示，最后才截断标题
    const gap = 2
    while (hints.length > 1 && visibleWidth(title) + gap + visibleWidth(buildRight()) > cols) {
        hints.shift()
    }

    const right = buildRight()
    const room = Math.max(0, cols - visibleWidth(right) - gap)
    const left = truncateTo(title, room)

    return inverse(
        padEnd(padEnd(`${left}${' '.repeat(gap)}`, cols - visibleWidth(right)) + right, cols),
    )
}

/**
 * 整屏查看器：切到 alternate screen，自己画每一屏。
 *
 * 不用 DOM overlay，内容直接写进 xterm。退出时 alt screen 还原，
 * 之前的 scrollback 完好无损。
 *
 * 视口变化时会按新宽度重新渲染并重画（alt buffer 不 reflow，必须整屏重来）。
 */
export function runPager(term: Term, input: PagerInput): Promise<void> {
    let cols = term.cols
    let rows = term.rows
    let height = Math.max(1, rows - 1)

    let lines: string[] = []
    let offset = 0

    let mode: Mode = 'browse'
    let query = ''
    let typing = ''
    let matches: number[] = []
    let matchIndex = -1

    const titles = input.outline ?? []
    let outlineAt: number[] = []
    let outlineCursor = 0
    let outlineOffset = 0

    /** 重新渲染并折行，按比例保住原来的阅读位置 */
    const rebuild = (): void => {
        const previousMax = Math.max(0, lines.length - height)
        const ratio = previousMax > 0 ? offset / previousMax : 0

        lines = input.render(cols).flatMap((line) => wrapAnsi(line, cols))
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

    const drawBody = (): string[] => {
        const parts: string[] = []
        for (let row = 0; row < height; row += 1) {
            const line = lines[offset + row] ?? ''
            const shown = query === '' ? line : markMatches(line, query)
            parts.push(`\x1b[${row + 1};1H\x1b[2K${shown}`)
        }
        return parts
    }

    const drawOutline = (): string[] => {
        outlineOffset = clampWindow(outlineCursor, outlineOffset, height)
        const parts: string[] = []

        for (let row = 0; row < height; row += 1) {
            const index = outlineOffset + row
            const title = titles[index]
            if (title === undefined) {
                parts.push(`\x1b[${row + 1};1H\x1b[2K`)
                continue
            }
            const active = index === outlineCursor
            const marker = active ? '\x1b[36m>\x1b[39m' : ' '
            const label = active
                ? `\x1b[36m${truncateTo(title, cols - 4)}\x1b[39m`
                : truncateTo(title, cols - 4)
            parts.push(`\x1b[${row + 1};1H\x1b[2K ${marker} ${label}`)
        }

        return parts
    }

    const statusLine = (): string => {
        if (mode === 'search') return inverse(padEnd(`/${typing}`, cols))
        if (mode === 'outline') {
            return pagerStatus({
                title: `${input.title} · 目录`,
                offset: outlineCursor,
                total: Math.max(1, titles.length),
                height: 1,
                cols,
                hints: ['↑↓ 选择', 'Enter 跳转', 'Esc 取消'],
            })
        }
        const extra =
            query === ''
                ? ''
                : matches.length === 0
                  ? `/${query} 无匹配`
                  : `/${query} ${matchIndex + 1}/${matches.length}`

        // 从低到高：窄终端会先丢掉前面几个
        const hints = ['j/k 行', '空格 翻页']
        if (titles.length > 0) hints.push('t 目录')
        hints.push('/ 搜索', 'q 退出')

        return pagerStatus({
            title: input.title,
            offset,
            total: lines.length,
            height,
            cols,
            extra,
            hints,
        })
    }

    const draw = (): void => {
        const parts = mode === 'outline' ? drawOutline() : drawBody()
        parts.push(`\x1b[${rows};1H\x1b[2K${statusLine()}`)
        term.write(parts.join(''))
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

    term.write(`${ALT_SCREEN_ON}\x1b[H\x1b[2J`)
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

        const quit = (): void => {
            clearTimeout(resizeTimer)
            releaseResize()
            release()
            term.write(ALT_SCREEN_OFF)
            resolve()
        }

        const handleSearchKey = (event: KeyboardEvent): boolean => {
            if (event.key === 'Enter') {
                query = typing
                recalcMatches()
                mode = 'browse'
                if (matches.length > 0) gotoMatch(matches.findIndex((line) => line >= offset))
                else draw()
                return true
            }
            if (event.key === 'Escape') {
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
            switch (event.key) {
                case 'ArrowUp':
                case 'k':
                    outlineCursor = Math.max(0, outlineCursor - 1)
                    draw()
                    return true
                case 'ArrowDown':
                case 'j':
                    outlineCursor = Math.min(titles.length - 1, outlineCursor + 1)
                    draw()
                    return true
                case 'Enter': {
                    const target = outlineAt[outlineCursor]
                    mode = 'browse'
                    if (target !== undefined && target >= 0) scrollTo(target)
                    draw()
                    return true
                }
                case 'Escape':
                case 'q':
                    mode = 'browse'
                    draw()
                    return true
            }
            return true
        }

        const handleBrowseKey = (event: KeyboardEvent): boolean => {
            switch (event.key) {
                case 'q':
                    quit()
                    return true
                case 'Escape':
                    // 有搜索就先把搜索清掉，再按一次才退出
                    if (query !== '') {
                        query = ''
                        matches = []
                        matchIndex = -1
                        draw()
                        return true
                    }
                    quit()
                    return true
                case '/':
                    mode = 'search'
                    typing = query
                    draw()
                    return true
                case 'n':
                    if (matches.length > 0) gotoMatch(matchIndex + 1)
                    return true
                case 'N':
                    if (matches.length > 0) gotoMatch(matchIndex - 1)
                    return true
                case 't':
                    if (titles.length > 0) {
                        mode = 'outline'
                        outlineCursor = 0
                        outlineOffset = 0
                        draw()
                    }
                    return true
                case 'j':
                case 'ArrowDown':
                    scrollTo(offset + 1)
                    return true
                case 'k':
                case 'ArrowUp':
                    scrollTo(offset - 1)
                    return true
                case ' ':
                case 'f':
                case 'PageDown':
                    scrollTo(offset + height)
                    return true
                case 'b':
                case 'PageUp':
                    scrollTo(offset - height)
                    return true
                case 'd':
                    scrollTo(offset + Math.floor(height / 2))
                    return true
                case 'u':
                    scrollTo(offset - Math.floor(height / 2))
                    return true
                case 'g':
                case 'Home':
                    scrollTo(0)
                    return true
                case 'G':
                case 'End':
                    scrollTo(lines.length)
                    return true
            }
            return true
        }

        const release = term.captureKeys(
            (event) => {
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
