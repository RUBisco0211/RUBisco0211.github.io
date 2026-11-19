import type { Command } from '../types.ts'

const echo: Command = {
  name: 'echo',
  description: '输出参数',
  usage: 'echo <文本…>',
  run(ctx, args) {
    ctx.term.println(args.join(' '))
  },
}

export default echo
