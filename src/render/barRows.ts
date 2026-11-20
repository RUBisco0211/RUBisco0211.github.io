import { dim } from './ansi.ts'
import { bar } from './chart.ts'
import { formatRow } from './table.ts'
import { truncateTo, visibleWidth } from './width.ts'

/**
 * label + 柱 + 右对齐数值 的成组柱状行。
 *
 * stats 和 tags 都要这个布局，柱子长度、列宽都按整组统一算，
 * 否则每行各自算会参差不齐。列宽策略（标签多宽、柱子多长）由调用方决定。
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
    /** 可选表头，按 [标签, (柱列留空), 数值] 三个单元格给 */
    readonly header?: readonly [string, string, string]
}

const DEFAULT_BAR_MAX = 24
const DEFAULT_BAR_MIN = 4

export function barRows(rows: readonly BarRow[], options: BarRowsOptions): string[] {
    const { cols, paint, labelPaint = (text: string) => text } = options
    const barMax = options.barMax ?? DEFAULT_BAR_MAX
    const barMin = options.barMin ?? DEFAULT_BAR_MIN
    // 表头也算进列宽，不然“标签 / 篇数”会把列挤歪
    const labelWidth = Math.max(
        options.labelWidth,
        options.header ? visibleWidth(options.header[0]) : 0,
    )
    const headerValueWidth = options.header ? visibleWidth(options.header[2]) : 0
    const max = rows.length > 0 ? Math.max(...rows.map((row) => row.value)) : 0
    const valueWidth = Math.max(headerValueWidth, ...rows.map((row) => visibleWidth(row.valueText)))
    // 2 + label + 2 + bar + 1 + value
    const barWidth = Math.max(barMin, Math.min(barMax, cols - labelWidth - valueWidth - 5))
    const widths = [labelWidth, barWidth, valueWidth]
    const layout = {
        indent: '  ',
        columns: [{}, {}, { align: 'right' as const }],
        gap: ['  ', ' '],
    }

    const out = options.header ? [formatRow(options.header, widths, layout)] : []
    for (const row of rows) {
        out.push(
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
    return out
}
