import { completePath } from '../complete.ts'
import { fail } from '../error.ts'
import type { Command } from '../types.ts'

const cd: Command = {
    name: 'cd',
    description: '切换目录',
    usage: 'cd [路径]',
    complete: (ctx, _argv, current) => completePath(ctx, current),
    run(ctx, args) {
        const error = ctx.chdir(args[0] ?? '/')
        if (error) fail(error)
    },
}

export default cd
