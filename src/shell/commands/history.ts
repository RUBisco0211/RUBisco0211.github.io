import { dim, green } from '../../term/ansi.ts'
import { select } from '../../term/select.ts'
import type { Command } from '../types.ts'

const history: Command = {
  name: 'history',
  description: '浏览历史命令，选中直接执行',
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

    // 重放的命令不会经过 read()，所以手动补一条历史
    ctx.term.appendHistory(picked.value)
    await ctx.run(picked.value)
  },
}

export default history
