/**
 * 命令错误。
 *
 * 命令不自己 println 红字，而是抛这个错误，由 shell.run() 捕获后交给
 * Term.printError() 统一染红输出：只有一处决定「错误长什么样」，
 * 命令里也就不会漏掉红色、不会各写各的文案。
 *
 * 注意和「意外异常」的区别：意外异常（bug）仍然一路抛给 main.ts，
 * 不会走到这里 —— 这不是用户输入的错，不该被静默吞掉。
 */
export class ShellError extends Error {
    /** 附带的提示，比如可选值列表，会以压暗样式跟在消息后面 */
    readonly hint?: string

    constructor(message: string, hint?: string) {
        super(message)
        this.name = 'ShellError'
        this.hint = hint
    }
}

/** 命令里报错的简写：`fail('没有这个路径：x')` */
export function fail(message: string, hint?: string): never {
    throw new ShellError(message, hint)
}
