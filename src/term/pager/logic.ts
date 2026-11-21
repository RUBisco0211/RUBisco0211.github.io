/**
 * pager 的纯逻辑部分：滚动换算、标题定位、状态栏拼装、选区清理。
 *
 * 这里不碰 xterm / Term / DOM，只处理字符串和数字，所以能直接在 node 里测。
 * 交互循环（切 alt screen、捕获按键、重绘）留在 index.ts。
 */

import { inverse } from '../../render/ansi.ts'
import { padEnd, stripAnsi, truncateTo, visibleWidth } from '../../render/width.ts'

/** 多少像素算一行。鼠标滚轮一格约 100px，所以一格 ≈ 1.25 行 */
const PIXELS_PER_LINE = 80

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

export function clampOffset(offset: number, total: number, height: number): number {
    const max = Math.max(0, total - height)
    return Math.min(Math.max(offset, 0), max)
}

/**
 * 滚轮 delta 换算成行数（可以是小数）。
 * deltaMode: 0 = 像素（触控板/平滑滚动），1 = 行，2 = 页。
 */
function wheelLines(deltaY: number, deltaMode = 0, pixelsPerLine = PIXELS_PER_LINE): number {
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

    // 提示由调用方提供，放不下就先从头部丢
    const hints = [...(options.hints ?? [])]
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
