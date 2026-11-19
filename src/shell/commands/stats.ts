import type { DocMeta } from '../../content/types.ts'
import { bold, cyan, dim, yellow } from '../../term/ansi.ts'
import { bar } from '../../term/chart.ts'
import { formatChars, formatCount } from '../../term/format.ts'
import { padEnd, truncateTo, visibleWidth } from '../../term/width.ts'
import type { Command } from '../types.ts'

/** 柱状图最多画多宽，以及最少留几格（窄终端下保证还能看出高低） */
const BAR_MAX = 24
const BAR_MIN = 4

export interface MonthBucket {
  readonly month: string
  readonly count: number
}

export interface SizeEntry {
  readonly name: string
  readonly chars: number
}

/** 按月聚合（只统计有日期的文章），新的在前 */
export function monthsOf(docs: readonly DocMeta[]): MonthBucket[] {
  const counts = new Map<string, number>()
  for (const doc of docs) {
    if (doc.kind !== 'post' || !doc.date) continue
    const month = doc.date.slice(0, 7)
    counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

/** 篇幅排行，长的在前 */
export function sizesOf(docs: readonly DocMeta[], limit = 5): SizeEntry[] {
  return docs
    .filter((doc) => doc.chars > 0)
    .map((doc) => ({ name: doc.slug.split('/').pop() ?? doc.slug, chars: doc.chars }))
    .sort((a, b) => b.chars - a.chars)
    .slice(0, limit)
}

interface BarRow {
  readonly label: string
  readonly value: number
  readonly valueText: string
}

/**
 * 一组柱子。列宽和柱宽按整组统一算，否则每行各自算会参差不齐。
 */
function barRows(rows: readonly BarRow[], cols: number, paint: (text: string) => string): string[] {
  if (rows.length === 0) return []

  const max = Math.max(...rows.map((row) => row.value))
  const labelCap = Math.max(8, Math.floor((cols - BAR_MIN) / 2))
  const labelWidth = Math.min(labelCap, Math.max(...rows.map((row) => visibleWidth(row.label))))
  const valueWidth = Math.max(...rows.map((row) => visibleWidth(row.valueText)))
  // 2 + label + 2 + bar + 1 + value
  const barWidth = Math.max(BAR_MIN, Math.min(BAR_MAX, cols - labelWidth - valueWidth - 5))

  return rows.map(
    (row) =>
      `  ${padEnd(truncateTo(row.label, labelWidth), labelWidth)}  ${paint(
        padEnd(bar(row.value, max, barWidth), barWidth),
      )} ${dim(row.valueText.padStart(valueWidth))}`,
  )
}

export function statsLines(docs: readonly DocMeta[], cols: number): string[] {
  const posts = docs.filter((doc) => doc.kind === 'post')
  const projects = docs.filter((doc) => doc.kind === 'project')
  const tags = new Set(docs.flatMap((doc) => doc.tags))
  const chars = docs.reduce((sum, doc) => sum + doc.chars, 0)

  const lines = [
    bold('站点统计'),
    `文章 ${cyan(String(posts.length))} 篇 · 项目 ${cyan(String(projects.length))} 个 · ${formatChars(
      chars,
    )} · ${cyan(String(tags.size))} 个标签`,
    '',
  ]

  const months = monthsOf(posts)
  if (months.length > 0) {
    const rows = months.map((bucket) => ({
      label: bucket.month,
      value: bucket.count,
      valueText: String(bucket.count),
    }))
    lines.push(dim('按月'), ...barRows(rows, cols, yellow), '')
  }

  const sizes = sizesOf(posts)
  if (sizes.length > 0) {
    const rows = sizes.map((entry) => ({
      label: entry.name,
      value: entry.chars,
      valueText: formatCount(entry.chars),
    }))
    lines.push(dim(`篇幅 Top ${sizes.length}`), ...barRows(rows, cols, cyan))
  }

  return lines
}

const stats: Command = {
  name: 'stats',
  description: '站点统计',
  run(ctx) {
    for (const line of statsLines(ctx.content.docs, ctx.term.cols)) ctx.term.println(line)
  },
}

export default stats
