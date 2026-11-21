import type { DocMeta } from '@/content/types.ts'
import { dim } from '@/render/ansi.ts'
import { headingTitles, renderMarkdown } from '@/render/markdown.ts'
import { formatTable } from '@/render/table.ts'
import type { PagerInput } from '@/tui/views/pager.ts'
import { openOutline } from './outline.ts'

export interface PagerInputOptions {
    /** 打开后立即定位到这个搜索词，并高亮所有匹配（从 search 跳过来时用） */
    readonly focus?: string
}

/**
 * 把 DocMeta + 正文排成 pager 的输入（视图模型）。
 *
 * 这是 cat / search / tags 共用的命令层辅助件（放在 commands/utils/，不是跨层通用层）：
 * 只有命令层同时认识 content 和 tui，所以适配器归这里——content 不认识 pager，
 * tui 也不认识 content。
 *
 * 返回纯数据，没有 term、没有生命周期。
 */
export function toPagerInput(
    doc: DocMeta,
    text: string,
    options: PagerInputOptions = {},
): PagerInput {
    const outline = headingTitles(text)
    const hints = ['j/k 行', '空格 翻页']
    if (outline.length > 0) hints.push('t 目录')
    hints.push('/ 搜索', 'y 复制', 'q 退出')

    // frontmatter 固定在第一段，先排好版，不用每次折行重算
    const meta = formatTable(doc.frontmatter.map(([key, value]) => [dim(key), value]))
    // 正文从 meta 之后的空行开始；从 search 跳过来时跳过 frontmatter 再找匹配
    const bodyStart = meta.length + 1

    return {
        title: doc.title,
        focus: options.focus,
        focusFrom: bodyStart,
        labels: {
            noMatch: (query: string) => `/${query} 无匹配`,
            hints,
        },
        // t 打开 outline 选择器
        bindings:
            outline.length > 0
                ? {
                      t: (view, session) =>
                          openOutline(view, session, { title: doc.title, titles: outline }),
                  }
                : undefined,
        // 视口变了 pager 会带着新宽度再调一次 render
        render: (cols: number) => [...meta, '', ...renderMarkdown(text, cols).split('\n')],
    }
}
