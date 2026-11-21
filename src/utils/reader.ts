import type { DocMeta } from '../content/types.ts'
import type { Term } from '../term/terminal.ts'

export interface ReadOptions {
    /** 打开后立即定位到这个搜索词，并高亮所有匹配（从 search 跳过来时用） */
    readonly focus?: string
}

/**
 * 在 pager 里打开一篇文档。
 *
 * 只依赖 `Term`——它不读 fs / content / config，正文由调用方取好再传进来。
 * 之所以放在 utils 而不是 commands：它不是一条命令，而是 cat / search / tags
 * 共用的「把一篇文档丢进阅读器」的动作。
 */
export async function readDoc(
    term: Term,
    doc: DocMeta,
    text: string,
    options: ReadOptions = {},
): Promise<void> {
    const [{ renderMarkdown, headingTitles }, { runPager }, { dim }, { formatTable }] =
        await Promise.all([
            import('../render/markdown.ts'),
            import('../term/tui/components/pager/index.ts'),
            import('../render/ansi.ts'),
            import('../render/table.ts'),
        ])

    const outline = headingTitles(text)
    const hints = ['j/k 行', '空格 翻页']
    if (outline.length > 0) hints.push('t 目录')
    hints.push('/ 搜索', 'y 复制', 'q 退出')

    // frontmatter 固定在第一段，先排好版，不用每次折行重算
    const meta = formatTable(doc.frontmatter.map(([key, value]) => [dim(key), value]))
    // 正文从 meta 之后的空行开始；从 search 跳过来时跳过 frontmatter 再找匹配
    const bodyStart = meta.length + 1

    // 视口变了 pager 会带着新宽度再调一次 render
    await runPager(term, {
        title: doc.title,
        outline,
        focus: options.focus,
        focusFrom: bodyStart,
        labels: {
            outline: '目录',
            outlineHints: ['↑↓ 选择', 'Enter 跳转', 'Esc 取消'],
            noMatch: (query) => `/${query} 无匹配`,
            hints,
        },
        render: (cols) => [...meta, '', ...renderMarkdown(text, cols).split('\n')],
    })
}
