/**
 * 显示宽度计算。
 *
 * 终端里对齐必须按"占几列"算，不能按字符数：中文、日文、全角标点都占 2 列，
 * 而且带 ANSI 转义序列的字符串按 length 算会完全错位。
 */

const OSC8 = /\x1b\]8;;[^\x1b]*\x1b\\/g
const SGR = /\x1b\[[0-9;]*m/g

/** 去掉 ANSI（SGR）和 OSC 8 超链接序列 */
export function stripAnsi(text: string): string {
    return text.replace(OSC8, '').replace(SGR, '')
}

/** 粗略的 East Asian Width：这些区段按 2 列算 */
function isWide(code: number): boolean {
    return (
        (code >= 0x1100 && code <= 0x115f) ||
        (code >= 0x2e80 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe30 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6)
    )
}

export function visibleWidth(text: string): number {
    let width = 0
    for (const char of stripAnsi(text)) {
        width += isWide(char.codePointAt(0) ?? 0) ? 2 : 1
    }
    return width
}

/** 按显示宽度截断，超出时末尾补省略号 */
export function truncateTo(text: string, width: number): string {
    if (width <= 0) return ''
    if (visibleWidth(text) <= width) return text
    if (width === 1) return '…'

    let out = ''
    let used = 0
    for (const char of text) {
        const w = isWide(char.codePointAt(0) ?? 0) ? 2 : 1
        if (used + w > width - 1) break
        out += char
        used += w
    }
    return `${out}…`
}

/** 按显示宽度右补空格，带颜色的字符串也能正确对齐 */
export function padEnd(text: string, width: number): string {
    return text + ' '.repeat(Math.max(0, width - visibleWidth(text)))
}
