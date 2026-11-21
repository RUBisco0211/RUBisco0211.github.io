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

/** 零宽字符：组合用声调符号、变体选择符、连接符等，终端不占列 */
function isZeroWidth(code: number): boolean {
    return (
        (code >= 0x0300 && code <= 0x036f) || // combining diacritical marks
        (code >= 0xfe00 && code <= 0xfe0f) || // variation selectors
        code === 0x200b || // zero width space
        code === 0x200c || // zero width non-joiner
        code === 0x200d || // zero width joiner
        code === 0x2060 || // word joiner
        code === 0xfeff // BOM / zero width no-break space
    )
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
        (code >= 0xffe0 && code <= 0xffe6) ||
        // emoji 和符号（绝大多数终端按 2 列渲染）
        (code >= 0x1f000 && code <= 0x1f02f) ||
        (code >= 0x1f0a0 && code <= 0x1f0ff) ||
        (code >= 0x1f100 && code <= 0x1f1ff) ||
        (code >= 0x1f200 && code <= 0x1f2ff) ||
        (code >= 0x1f300 && code <= 0x1f5ff) ||
        (code >= 0x1f600 && code <= 0x1f64f) ||
        (code >= 0x1f680 && code <= 0x1f6ff) ||
        (code >= 0x1f900 && code <= 0x1f9ff) ||
        (code >= 0x1fa70 && code <= 0x1faff) ||
        (code >= 0x2600 && code <= 0x27bf) ||
        (code >= 0x2b00 && code <= 0x2bff)
    )
}

/** 一个码点占几列 */
function charWidth(code: number): number {
    if (isZeroWidth(code)) return 0
    return isWide(code) ? 2 : 1
}

export function visibleWidth(text: string): number {
    let width = 0
    for (const char of stripAnsi(text)) {
        width += charWidth(char.codePointAt(0) ?? 0)
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
        const w = charWidth(char.codePointAt(0) ?? 0)
        // 零宽字符（组合符号）跟着前一个字一起走，不单独占位
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

/** 按显示宽度左补空格，右对齐用 */
export function padStart(text: string, width: number): string {
    return ' '.repeat(Math.max(0, width - visibleWidth(text))) + text
}
