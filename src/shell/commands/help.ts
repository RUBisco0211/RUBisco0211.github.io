import { bold, cyan, dim, red } from '../../term/ansi.ts'
import { padEnd, visibleWidth } from '../../term/width.ts'
import type { Command } from '../types.ts'

const help: Command = {
  name: 'help',
  description: '列出可用命令，或查看某条命令的用法',
  usage: 'help [命令]',
  run(ctx, args) {
    const wanted = args[0]

    if (wanted) {
      const command = ctx.registry.get(wanted)
      if (!command) {
        ctx.term.println(red(`没有这个命令：${wanted}`))
        return
      }
      ctx.term.println(`${bold(command.name)}  ${command.description}`)
      if (command.usage) ctx.term.println(dim(`用法：${command.usage}`))
      return
    }

    const list = ctx.registry.list()
    // 第一列直接放 usage：它就是「命令名 + 参数」，比只列名字信息量更大
    const label = (command: Command): string => command.usage ?? command.name
    const width = list.reduce((max, command) => Math.max(max, visibleWidth(label(command))), 0)

    ctx.term.println(bold('可用命令'))
    for (const command of list) {
      ctx.term.println(`  ${cyan(padEnd(label(command), width))}  ${dim(command.description)}`)
    }

    const aliases = Object.entries(ctx.config.aliases)
    if (aliases.length > 0) {
      ctx.term.println()
      ctx.term.println(bold('别名'))
      for (const [name, expansion] of aliases) {
        ctx.term.println(`  ${cyan(padEnd(name, width))}  ${dim(`→ ${expansion}`)}`)
      }
    }

    ctx.term.println()
  },
}

export default help
