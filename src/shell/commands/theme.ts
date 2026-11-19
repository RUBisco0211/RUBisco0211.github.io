import { dim, green, red } from '../../term/ansi.ts'
import type { Command } from '../types.ts'

const theme: Command = {
  name: 'theme',
  description: '切换主题，不带参数则列出',
  usage: 'theme [名字]',
  run(ctx, args) {
    const name = args[0]

    if (!name) {
      const current = ctx.theme.current()
      const list = ctx.theme
        .names()
        .map((n) => (n === current ? green(n) : n))
        .join(dim(' / '))
      ctx.term.println(`主题：${list}`)
      ctx.term.println(
        dim(`当前 ${current} · ${ctx.theme.mode()}　用 theme <名字> 切换，深浅跟随系统`),
      )
      return
    }

    if (ctx.theme.set(name)) {
      ctx.term.println(green(`主题已切换为 ${name}（${ctx.theme.mode()}）`))
      return
    }

    ctx.term.println(
      `${red(`没有这个主题：${name}`)}${dim(`  可选：${ctx.theme.names().join(' / ')}`)}`,
    )
  },
}

export default theme
