/**
 * 用方块字符画横向柱状图。
 *
 * 只负责"多长"，颜色和排版交给调用方 —— 这样同一条柱子在 ls / stats / tags
 * 里都能上不同颜色。
 */
const BAR_CHAR = '█'

/** value 相对 max 的长度，至少 1 格（非零时），最多 width 格 */
function barLength(value: number, max: number, width: number): number {
    if (value <= 0 || max <= 0 || width <= 0) return 0
    return Math.min(width, Math.max(1, Math.round((value / max) * width)))
}

export function bar(value: number, max: number, width: number): string {
    return BAR_CHAR.repeat(barLength(value, max, width))
}
