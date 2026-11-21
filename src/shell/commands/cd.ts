import { completePath } from '@/shell/complete.ts'
import { fail } from '@/shell/error.ts'
import type { Command } from '@/shell/types.ts'

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
