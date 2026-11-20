/**
 * shell 命令错误统一封装
 *
 * shell 层自己不 println 而是抛这个错误，由 shell.run 捕获并渲染
 *
 */
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
