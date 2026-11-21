import type { Command } from '@/shell/types.ts'
import { runMatrix } from '@/tui/views/matrix.ts'

const matrix: Command = {
    name: 'matrix',
    description: '数字雨',
    run(ctx) {
        return runMatrix(ctx.term)
    },
}

export default matrix
