import { inverse } from '@/render/ansi.ts'
import { padEnd, truncateTo, visibleWidth } from '@/render/width.ts'

export interface StatusBarOptions {
    readonly left: string
    readonly right?: string
    /** 操作提示，**按重要性从低到高**排列：放不下时从头部丢，最后一个留到最后 */
    readonly hints?: readonly string[]
    readonly cols: number
}

/**
 * 底部状态栏：左边标题，右边进度和操作提示，整行反显。
 *
 * 放不下时先丢最不重要的提示，最后才截断标题。
 */
export function statusBar(options: StatusBarOptions): string {
    const { left, right: extra, cols } = options
    const hints = [...(options.hints ?? [])]
    const gap = 2
    const buildRight = (): string => [extra, ...hints].filter(Boolean).join('  ·  ')

    while (hints.length > 1 && visibleWidth(left) + gap + visibleWidth(buildRight()) > cols) {
        hints.shift()
    }

    const right = buildRight()
    const room = Math.max(0, cols - visibleWidth(right) - gap)
    const leftText = truncateTo(left, room)

    return inverse(
        padEnd(padEnd(`${leftText}${' '.repeat(gap)}`, cols - visibleWidth(right)) + right, cols),
    )
}
