import { padEnd, padStart, visibleWidth } from './width.ts'

/**
 * 多行对齐成表格。
 *
 * 所有「测列宽 + 逐列补齐 + 拼接」的地方都走这里：ls / help / cat / neofetch /
 * stats / tags / Tab 补全。单元格可以带 ANSI 和 OSC 8，宽度一律按 visibleWidth 算。
 *
 * 只负责对齐，不负责截断：需要截的内容由调用方先 truncateTo 好再传进来。
 */

/** 一列的对齐方式 */
export interface Column {
    /** 数值列右对齐；默认左对齐 */
    readonly align?: 'left' | 'right'
}

/** 列间距：字符串表示所有列间相同，数组按边界逐个指定 */
export type Gap = string | readonly string[]

export interface TableOptions {
    /** 列间距，默认两个空格 */
    readonly gap?: Gap
    /** 每行前缀，默认空；用于整块缩进 */
    readonly indent?: string
    /** 每列对齐设置，按列下标对应 */
    readonly columns?: readonly Column[]
    /** 是否裁掉行尾空白，默认 true */
    readonly trim?: boolean
}

const DEFAULT_GAP = '  '

function gapAt(gap: Gap | undefined, index: number): string {
    if (gap === undefined) return DEFAULT_GAP
    return typeof gap === 'string' ? gap : (gap[index] ?? '')
}

/** 每列的最大显示宽度，ANSI 不计入 */
export function columnWidths(rows: readonly (readonly string[])[]): number[] {
    const count = rows.reduce((max, row) => Math.max(max, row.length), 0)
    return Array.from({ length: count }, (_, column) =>
        rows.reduce((max, row) => Math.max(max, visibleWidth(row[column] ?? '')), 0),
    )
}

/** 各列宽度加上间距后的总显示宽度，给画横线用 */
export function rowWidth(widths: readonly number[], options: TableOptions = {}): number {
    let total = widths.reduce((sum, width) => sum + width, 0)
    for (let i = 1; i < widths.length; i += 1) total += visibleWidth(gapAt(options.gap, i - 1))
    return total
}

/** 把一行的单元格按列宽补齐并对齐，拼成一行 */
export function formatRow(
    cells: readonly string[],
    widths: readonly number[],
    options: TableOptions = {},
): string {
    const parts: string[] = []
    cells.forEach((cell, index) => {
        if (index > 0) parts.push(gapAt(options.gap, index - 1))
        const width = widths[index] ?? 0
        parts.push(
            options.columns?.[index]?.align === 'right'
                ? padStart(cell, width)
                : padEnd(cell, width),
        )
    })
    const line = `${options.indent ?? ''}${parts.join('')}`
    return options.trim === false ? line : line.trimEnd()
}

/** 测列宽并把多行排成表格；每行是各列单元格的数组 */
export function formatTable(
    rows: readonly (readonly string[])[],
    options: TableOptions & { readonly widths?: readonly number[] } = {},
): string[] {
    const widths = options.widths ?? columnWidths(rows)
    return rows.map((row) => formatRow(row, widths, options))
}
