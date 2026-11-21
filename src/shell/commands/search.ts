import { searchDocs } from '@/content/search.ts'
import type { SearchHit } from '@/content/search.ts'
import { dim } from '@/render/ansi.ts'
import { select } from '@/tui/views/select'
import { toPagerInput } from '@/shell/commands/utils/pager-input.ts'
import { runPager } from '@/tui/views/pager.ts'
import { fail, printUsage } from '@/shell/error.ts'
import type { Command } from '@/shell/types.ts'

const search: Command = {
    name: 'search',
    description: '搜索标题、标签和正文',
    usage: 'search <词…>',
    async run(ctx, args) {
        const query = args.join(' ').trim()
        if (!query) printUsage(search)

        const hits = await searchDocs(ctx.content, query)
        if (hits.length === 0) {
            ctx.term.println(dim(`没有匹配的内容：${query}`))
            return
        }

        const picked = await select<SearchHit>(ctx.term, {
            title: `搜索 “${query}”`,
            labels: { empty: '无匹配', footer: '↑↓ 移动 · Enter 打开 · Esc 取消' },
            hint: `${hits.length} 条`,
            items: hits.map((hit) => ({
                value: hit,
                label: hit.doc.title,
                detail: [hit.doc.date, hit.doc.slug].filter(Boolean).join('  '),
            })),
        })

        if (!picked) return

        const text = await ctx.content.text(picked.doc.slug)
        if (text === undefined) fail(`正文加载失败：${picked.doc.slug}`)
        await runPager(ctx.term, toPagerInput(picked.doc, text, { focus: picked.term }))
    },
}

export default search
