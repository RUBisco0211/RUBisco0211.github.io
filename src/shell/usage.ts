import { red } from '../term/ansi.ts'
import type { Command, Ctx } from './types.ts'

/**
 * 参数不足时的统一提示。
 *
 * 文案取自 command.usage，命令里不再各写一份，避免和字段漂移。
 */
export function printUsage(ctx: Ctx, command: Command): void {
    ctx.term.println(red(`用法：${command.usage ?? command.name}`))
}
