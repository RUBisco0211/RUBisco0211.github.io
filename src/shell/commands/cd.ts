import { completePath } from '../complete.ts'
import { red } from '../../term/ansi.ts'
import type { Command } from '../types.ts'

const cd: Command = {
  name: 'cd',
  description: '切换目录，不带参数回到根目录',
  usage: 'cd [路径]',
  complete: (ctx, _argv, current) => completePath(ctx, current),
  run(ctx, args) {
    const error = ctx.chdir(args[0] ?? '/')
    if (error) ctx.term.println(red(error))
  },
}

export default cd
