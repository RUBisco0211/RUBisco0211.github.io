import { dim } from './ansi.ts'
import { bar } from './chart.ts'
import { formatRow } from './table.ts'
import { truncateTo, visibleWidth } from './width.ts'

/**
 * label + 柱 + 右对齐数值 的成组柱状行。
 *
 * stats 用它排版，柱子长度、列宽都按整组统一算，否则每行各自算会参差不齐。
 * 列宽策略（标签多宽、柱子多长）由调用方决定。
 */
export interface BarRow {
    readonly label: string
    readonly value: number
    readonly valueText: string
}

export interface BarRowsOptions {
    /** 终端列数，用来分配给柱子 */
    readonly cols: number
    /** 标签列宽度；内容超出用 truncateTo 截断 */
    readonly labelWidth: number
    /** 柱子上色 */
    readonly paint: (text: string) => string
    /** 标签上色，默认不上色 */
    readonly labelPaint?: (text: string) => string
    /** 柱宽上限，默认 24 */
    readonly barMax?: number
    /** 柱宽下限，默认 4 */
    readonly barMin?: number
}

const DEFAULT_BAR_MAX = 24
const DEFAULT_BAR_MIN = 4

export function barRows(rows: readonly BarRow[], options: BarRowsOptions): string[] {
    if (rows.length === 0) return []

    const { cols, labelWidth, paint, labelPaint = (text: string) => text } = options
    const barMax = options.barMax ?? DEFAULT_BAR_MAX
    const barMin = options.barMin ?? DEFAULT_BAR_MIN
    const max = Math.max(...rows.map((row) => row.value))
    const valueWidth = Math.max(...rows.map((row) => visibleWidth(row.valueText)))
    // 2 + label + 2 + bar + 1 + value
    const barWidth = Math.max(barMin, Math.min(barMax, cols - labelWidth - valueWidth - 5))
    const widths = [labelWidth, barWidth, valueWidth]
    const layout = {
        indent: '  ',
        columns: [{}, {}, { align: 'right' as const }],
        gap: ['  ', ' '],
    }

    return rows.map((row) =>
        formatRow(
            [
                labelPaint(truncateTo(row.label, labelWidth)),
                paint(bar(row.value, max, barWidth)),
                dim(row.valueText),
            ],
            widths,
            layout,
        ),
    )
}
