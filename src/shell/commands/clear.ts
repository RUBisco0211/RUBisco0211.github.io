import type { Command } from '../types.ts'

const clear: Command = {
  name: 'clear',
  description: '清屏',
  run(ctx) {
    ctx.term.clear()
  },
}

export default clear
