import { dim, red } from './ansi.ts'

/** 1786 → '1.8k'，832 → '832'，18000 → '18k' */
export function formatCount(count: number): string {
    if (count <= 0) return '-'
    if (count < 1000) return String(count)
    const k = count / 1000
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`
}

/** 45403 → '4.5 万字'，812 → '812 字' */
export function formatChars(count: number): string {
    if (count < 10000) return `${count} 字`
    return `${(count / 10000).toFixed(1)} 万字`
}

/** 任意异常 → 终端里能显示的文本。Error 取 message，其他直接 String */
export function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/**
 * 错误的一行文本：红字，可选提示压暗跟在后面。
 *
 * 只认「消息 + 可选提示」两个字符串，不知道 ShellError —— 那层语义在 shell，
 * 这里只管渲染。
 */
export function formatError(error: unknown, hint?: string): string {
    const message = errorText(error)
    return hint ? `${red(message)}${dim(`  ${hint}`)}` : red(message)
}
