import { completePath } from '../complete.ts'
import { resolveDoc } from '../doc.ts'
import type { Command } from '../types.ts'

const cat: Command = {
    name: 'cat',
    description: '阅读文档',
    usage: 'cat <文件>',
    complete: (ctx, _argv, current) => completePath(ctx, current),
    async run(ctx, args) {
        const resolved = await resolveDoc(ctx, cat, args)
        const { doc, text } = resolved

        // [NOTE] markdown 渲染器和 pager 只有 cat 用得上，按需加载以减轻首屏加载压力
        const [{ renderMarkdown, headingTitles }, { runPager }, { dim }] = await Promise.all([
            import('../../render/markdown.ts'),
            import('../../term/pager.ts'),
            import('../../render/ansi.ts'),
        ])

        const labelWidth = doc.frontmatter.reduce((max, [key]) => Math.max(max, key.length), 0)
        const outline = headingTitles(text)
        const hints = ['j/k 行', '空格 翻页']
        if (outline.length > 0) hints.push('t 目录')
        hints.push('/ 搜索', 'y 复制', 'q 退出')

        // 视口变了 pager 会带着新宽度再调一次 render
        await runPager(ctx.term, {
            title: doc.title,
            outline,
            labels: {
                outline: '目录',
                outlineHints: ['↑↓ 选择', 'Enter 跳转', 'Esc 取消'],
                noMatch: (query) => `/${query} 无匹配`,
                hints,
            },
            render: (cols) => [
                ...doc.frontmatter.map(
                    ([key, value]) => `${dim(key.padEnd(labelWidth))}  ${value}`,
                ),
                '',
                ...renderMarkdown(text, cols).split('\n'),
            ],
        })
    },
}

export default cat
