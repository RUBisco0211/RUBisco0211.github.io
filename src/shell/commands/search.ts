import { searchDocs } from '../../content/search.ts'
import { printUsage } from '../usage.ts'
import { cyan, dim, gray } from '../../term/ansi.ts'
import type { Command } from '../types.ts'

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

        ctx.term.println(dim(`${hits.length} 条结果`))
        for (const hit of hits) {
            const meta = [hit.doc.date, hit.doc.tags.join(' ')].filter(Boolean).join('  ')
            ctx.term.println()
            ctx.term.println(`${cyan(hit.doc.title)}${meta ? `  ${dim(meta)}` : ''}`)
            ctx.term.println(dim(`  ${hit.doc.slug}`))
            if (hit.snippet) ctx.term.println(gray(`  ${hit.snippet}`))
        }
        ctx.term.println()
    },
}

export default search
