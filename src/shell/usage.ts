import type { Command } from './types.ts'
import { fail } from './error.ts'

/**
 * 参数不足时的统一提示。
 *
 * 文案取自 command.usage，命令里不再各写一份，避免和字段漂移。
 * 走和运行时错误同一个通道（ShellError），由 shell.run() 统一染红。
 */
export function printUsage(command: Command): never {
    fail(`用法：${command.usage ?? command.name}`)
}
