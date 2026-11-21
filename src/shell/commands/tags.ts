import type { DocMeta } from '../../content/types.ts'
import { dim } from '../../render/ansi.ts'
import { select } from '../../term/tui/components/select.ts'
import { readDoc } from '../../utils/reader.ts'
import { fail } from '../error.ts'
import type { Command, Ctx } from '../types.ts'

interface TagBucket {
    readonly tag: string
    readonly docs: readonly DocMeta[]
}

/** 按标签聚合，篇数多的在前，同数按名字排 */
function tagBuckets(docs: readonly DocMeta[]): TagBucket[] {
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
function findTag(buckets: readonly TagBucket[], name: string): TagBucket | undefined {
    const key = name.trim().toLowerCase()
    return buckets.find((bucket) => bucket.tag.toLowerCase() === key)
}

/** 某个标签下的文章，新的在前 */
function tagDocs(bucket: TagBucket): DocMeta[] {
    return [...bucket.docs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/** 列出标签下的文章，选中就读。等价于 `tags <标签>` */
async function pickTagDocs(ctx: Ctx, bucket: TagBucket): Promise<void> {
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
    await readDoc(ctx.term, doc, text)
}

const tags: Command = {
    name: 'tags',
    description: '标签列表',
    usage: 'tags [标签]',
    async run(ctx, args) {
        const buckets = tagBuckets(ctx.content.docs)
        const wanted = args[0]

        if (wanted) {
            const bucket = findTag(buckets, wanted)
            if (!bucket) {
                const names = buckets
                    .slice(0, 8)
                    .map((item) => item.tag)
                    .join(' / ')
                fail(`没有这个标签：${wanted}`, `可选：${names}`)
            }
            await pickTagDocs(ctx, bucket)
            return
        }

        if (buckets.length === 0) {
            ctx.term.println(dim('还没有任何标签'))
            return
        }

        const picked = await select(ctx.term, {
            title: '标签',
            hint: `${buckets.length} 个`,
            labels: { empty: '无标签', footer: '↑↓ 移动 · Enter 查看 · Esc 取消' },
            items: buckets.map((bucket) => ({
                value: bucket.tag,
                label: bucket.tag,
                detail: `${bucket.docs.length} 篇`,
            })),
        })

        if (!picked) return

        const bucket = buckets.find((item) => item.tag === picked)
        if (bucket) await pickTagDocs(ctx, bucket)
    },
}

export default tags
