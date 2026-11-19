import { displayPath } from '../path.ts'
import type { Command } from '../types.ts'

const pwd: Command = {
    name: 'pwd',
    description: '显示当前目录',
    run(ctx) {
        ctx.term.println(displayPath(ctx.cwd))
    },
}

export default pwd
