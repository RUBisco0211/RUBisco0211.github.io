/**
 * shell 命令错误统一封装
 *
 * shell 层自己不 println 而是抛这个错误，由 shell.run 捕获并渲染
 *
 */
import type { Command } from './types.ts'

export class ShellError extends Error {
    /** 附带提示 */
    readonly hint?: string

    constructor(message: string, hint?: string) {
        super(message)
        this.name = 'ShellError'
        this.hint = hint
    }
}

/** 给命令提供抛出错误的接口 */
export function fail(message: string, hint?: string): never {
    throw new ShellError(message, hint)
}

/**
 * 参数不足时的统一提示。
 *
 * 文案取自 command.usage，命令里不再各写一份，避免和字段漂移。
 * 走和运行时错误同一个通道（ShellError），由 shell.run() 统一染红。
 */
export function printUsage(command: Command): never {
    fail(`用法：${command.usage ?? command.name}`)
}
