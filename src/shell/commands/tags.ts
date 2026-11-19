import type { DocMeta } from '../../content/types.ts'
import { bold, cyan, dim, yellow } from '../../term/ansi.ts'
import { bar } from '../../term/chart.ts'
import { padEnd, truncateTo, visibleWidth } from '../../term/width.ts'
import type { Command } from '../types.ts'

const BAR_MAX = 20
const BAR_MIN = 3

export interface TagBucket {
  readonly tag: string
  readonly docs: readonly DocMeta[]
}

/** 按标签聚合，篇数多的在前，同数按名字排 */
export function tagBuckets(docs: readonly DocMeta[]): TagBucket[] {
  const map = new Map<string, DocMeta[]>()
  for (const doc of docs) {
    for (const tag of doc.tags) {
      const bucket = map.get(tag)
      if (bucket) bucket.push(doc)
      else map.set(tag, [doc])
    }
  }
  return [...map.entries()]
    .map(([tag, items]) => ({ tag, docs: items }))
    .sort((a, b) => b.docs.length - a.docs.length || a.tag.localeCompare(b.tag, 'zh-Hans-CN'))
}

/** 找标签，忽略大小写 */
export function findTag(buckets: readonly TagBucket[], name: string): TagBucket | undefined {
  const key = name.trim().toLowerCase()
  return buckets.find((bucket) => bucket.tag.toLowerCase() === key)
}

export function tagsLines(docs: readonly DocMeta[], cols: number): string[] {
  const buckets = tagBuckets(docs)
  if (buckets.length === 0) return [dim('还没有任何标签')]

  const max = Math.max(...buckets.map((bucket) => bucket.docs.length))
  const countWidth = String(buckets.length).length
  const labelWidth = Math.max(
    ...buckets.map((bucket) => visibleWidth(bucket.tag)),
    // 太长的标签截断，别把柱子挤没
    Math.min(24, Math.floor(cols / 2)),
  )

  const lines = [dim(`${buckets.length} 个标签`), '']

  for (const bucket of buckets) {
    const count = bucket.docs.length
    const barWidth = Math.max(BAR_MIN, Math.min(BAR_MAX, cols - labelWidth - countWidth - 4))
    lines.push(
      `  ${cyan(padEnd(truncateTo(bucket.tag, labelWidth), labelWidth))}  ${yellow(
        padEnd(bar(count, max, barWidth), barWidth),
      )} ${dim(String(count))}`,
    )
  }

  return lines
}

/** 某个标签下的文章，新的在前 */
export function tagDocsLines(bucket: TagBucket, cols: number): string[] {
  const items = [...bucket.docs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const dateWidth = 10
  const nameWidth = Math.max(8, cols - dateWidth - 6)

  const lines = [bold(bucket.tag), dim(`${items.length} 篇`), '']

  for (const doc of items) {
    const name = doc.slug.split('/').pop() ?? doc.slug
    const title = doc.title !== name ? dim(`  ${truncateTo(doc.title, 24)}`) : ''
    lines.push(
      `  ${dim(doc.date ?? '-'.repeat(dateWidth))}  ${padEnd(
        truncateTo(name, nameWidth),
        nameWidth,
      )}${title}`.trimEnd(),
    )
  }

  return lines
}

const tags: Command = {
  name: 'tags',
  description: '标签列表',
  usage: 'tags [标签]',
  run(ctx, args) {
    const buckets = tagBuckets(ctx.content.docs)
    const wanted = args[0]

    if (!wanted) {
      for (const line of tagsLines(ctx.content.docs, ctx.term.cols)) ctx.term.println(line)
      return
    }

    const bucket = findTag(buckets, wanted)
    if (!bucket) {
      const names = buckets
        .slice(0, 8)
        .map((item) => item.tag)
        .join(' / ')
      ctx.term.println(`没有这个标签：${wanted}${dim(`  可选：${names}`)}`)
      return
    }

    for (const line of tagDocsLines(bucket, ctx.term.cols)) ctx.term.println(line)
  },
}

export default tags
