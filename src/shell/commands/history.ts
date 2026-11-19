import { dim, green } from '../../term/ansi.ts'
import { select } from '../../term/select.ts'
import type { Command } from '../types.ts'

const history: Command = {
  name: 'history',
  description: '浏览历史命令',
  usage: 'history [-c]',
  async run(ctx, args) {
    if (args[0] === '-c') {
      ctx.term.clearHistory()
      ctx.term.println(green('历史已清空'))
      return
    }

    const entries = ctx.term.historyEntries()
    if (entries.length === 0) {
      ctx.term.println(dim('还没有历史记录'))
      return
    }

    const picked = await select(ctx.term, {
      title: `历史 ${entries.length} 条`,
      hint: '输入关键字筛选',
      filterable: true,
      items: entries.map((text) => ({ value: text, label: text })),
    })

    if (!picked) return

    // 只填到提示符里，回车由用户自己按（这样还能继续改）
    ctx.prefill(picked.value)
  },
}

export default history
