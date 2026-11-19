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
    if (!resolved) return

    const { doc, text } = resolved

    // markdown 渲染器和 pager 加起来 40KB gzip 左右，只有 cat 用得上，
    // 静态 import 会把它们塞进首屏，所以按需加载。
    const [{ renderMarkdown, headingTitles }, { runPager }, { dim }] = await Promise.all([
      import('../../content/render.ts'),
      import('../../term/pager.ts'),
      import('../../term/ansi.ts'),
    ])

    const labelWidth = doc.frontmatter.reduce((max, [key]) => Math.max(max, key.length), 0)

    // 视口变了 pager 会带着新宽度再调一次 render
    await runPager(ctx.term, {
      title: doc.title,
      outline: headingTitles(text),
      render: (cols) => [
        ...doc.frontmatter.map(([key, value]) => `${dim(key.padEnd(labelWidth))}  ${value}`),
        '',
        ...renderMarkdown(text, cols).split('\n'),
      ],
    })
  },
}

export default cat
