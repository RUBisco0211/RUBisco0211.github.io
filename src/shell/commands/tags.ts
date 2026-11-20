import type { DocMeta } from '../../content/types.ts'
import { cyan, dim, yellow } from '../../render/ansi.ts'
import { barRows, type BarRow } from '../../render/barRows.ts'
import { select } from '../../term/select.ts'
import { readDoc } from '../reader.ts'
import { visibleWidth } from '../../render/width.ts'
import { fail } from '../error.ts'
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

    const labelWidth = Math.max(
        ...buckets.map((bucket) => visibleWidth(bucket.tag)),
        // 太长的标签截断，别把柱子挤没
        Math.min(24, Math.floor(cols / 2)),
    )

    const rows: BarRow[] = buckets.map((bucket) => ({
        label: bucket.tag,
        value: bucket.docs.length,
        valueText: String(bucket.docs.length),
    }))

    return [
        dim(`${buckets.length} 个标签`),
        '',
        ...barRows(rows, {
            cols,
            labelWidth,
            labelPaint: cyan,
            paint: yellow,
            barMax: BAR_MAX,
            barMin: BAR_MIN,
            header: [dim('标签'), '', dim('篇数')],
        }),
    ]
}

/** 某个标签下的文章，新的在前 */
export function tagDocs(bucket: TagBucket): DocMeta[] {
    return [...bucket.docs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

const tags: Command = {
    name: 'tags',
    description: '标签列表',
    usage: 'tags [标签]',
    async run(ctx, args) {
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
            fail(`没有这个标签：${wanted}`, `可选：${names}`)
        }

        const docs = tagDocs(bucket)
        const picked = await select(ctx.term, {
            title: `${bucket.tag} · ${docs.length} 篇`,
            labels: { empty: '无内容', footer: '↑↓ 移动 · Enter 打开 · Esc 取消' },
            items: docs.map((doc) => ({
                value: doc.slug,
                label: doc.title,
                detail: [doc.date, doc.slug].filter(Boolean).join('  '),
            })),
        })

        if (!picked) return

        const doc = ctx.content.find(picked)
        const text = await ctx.content.text(picked)
        if (!doc || text === undefined) fail(`正文加载失败：${picked}`)
        await readDoc(ctx, doc, text)
    },
}

export default tags
