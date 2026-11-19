/**
 * ANSI 样式原语。
 *
 * 设计要点：每个样式带**精确的关闭码**（`\x1b[22m`、`\x1b[39m`…）而不是统一的
 * `\x1b[0m`，所以可以嵌套：
 *
 *   bold(red('注意'))  →  \x1b[1m\x1b[31m注意\x1b[39m\x1b[22m
 *
 * 用 `\x1b[0m` 收尾的话内层会把外层一起清掉，嵌套就废了。
 *
 * 颜色用 16 色名（red/green/…）而不是硬编码的 256 色号 —— 它们由主题的
 * ITheme 决定，所以换主题时输出颜色自动跟着走。
 */

const ESC = '\x1b'

export interface Style {
    (text: string): string
    readonly open: string
    readonly close: string
}

function makeStyle(open: string, close: string): Style {
    const fn = (text: string): string => open + text + close
    return Object.assign(fn, { open, close })
}

/**
 * OSC 8 超链接。xterm 支持，点一下能在新标签打开。
 * 注意它是零宽的：visibleWidth() 会忽略这层包裹，对齐不受影响。
 */
export function hyperlink(href: string, text: string): string {
    return `\x1b]8;;${href}\x1b\\${text}\x1b]8;;\x1b\\`
}

// —— 字重与装饰 ——
export const bold = makeStyle(`${ESC}[1m`, `${ESC}[22m`)
export const dim = makeStyle(`${ESC}[2m`, `${ESC}[22m`)
export const italic = makeStyle(`${ESC}[3m`, `${ESC}[23m`)
export const underline = makeStyle(`${ESC}[4m`, `${ESC}[24m`)
export const inverse = makeStyle(`${ESC}[7m`, `${ESC}[27m`)
export const strike = makeStyle(`${ESC}[9m`, `${ESC}[29m`)

// —— 前景色（16 色，由主题决定） ——
export const black = makeStyle(`${ESC}[30m`, `${ESC}[39m`)
export const red = makeStyle(`${ESC}[31m`, `${ESC}[39m`)
export const green = makeStyle(`${ESC}[32m`, `${ESC}[39m`)
export const yellow = makeStyle(`${ESC}[33m`, `${ESC}[39m`)
export const blue = makeStyle(`${ESC}[34m`, `${ESC}[39m`)
export const magenta = makeStyle(`${ESC}[35m`, `${ESC}[39m`)
export const cyan = makeStyle(`${ESC}[36m`, `${ESC}[39m`)
export const white = makeStyle(`${ESC}[37m`, `${ESC}[39m`)
export const gray = makeStyle(`${ESC}[90m`, `${ESC}[39m`)
export const brightRed = makeStyle(`${ESC}[91m`, `${ESC}[39m`)
export const brightGreen = makeStyle(`${ESC}[92m`, `${ESC}[39m`)
export const brightYellow = makeStyle(`${ESC}[93m`, `${ESC}[39m`)
export const brightBlue = makeStyle(`${ESC}[94m`, `${ESC}[39m`)
export const brightMagenta = makeStyle(`${ESC}[95m`, `${ESC}[39m`)
export const brightCyan = makeStyle(`${ESC}[96m`, `${ESC}[39m`)

// —— 背景色 ——
export const bgBlack = makeStyle(`${ESC}[40m`, `${ESC}[49m`)
export const bgRed = makeStyle(`${ESC}[41m`, `${ESC}[49m`)
export const bgGreen = makeStyle(`${ESC}[42m`, `${ESC}[49m`)
export const bgYellow = makeStyle(`${ESC}[43m`, `${ESC}[49m`)
export const bgBlue = makeStyle(`${ESC}[44m`, `${ESC}[49m`)
export const bgMagenta = makeStyle(`${ESC}[45m`, `${ESC}[49m`)
export const bgCyan = makeStyle(`${ESC}[46m`, `${ESC}[49m`)
export const bgWhite = makeStyle(`${ESC}[47m`, `${ESC}[49m`)

// —— 256 色 / 真彩色（主题 palette 覆盖不到时用） ——
export function fg256(code: number): Style {
    return makeStyle(`${ESC}[38;5;${code}m`, `${ESC}[39m`)
}

export function bg256(code: number): Style {
    return makeStyle(`${ESC}[48;5;${code}m`, `${ESC}[49m`)
}

export function rgb(r: number, g: number, b: number): Style {
    return makeStyle(`${ESC}[38;2;${r};${g};${b}m`, `${ESC}[39m`)
}

export function bgRgb(r: number, g: number, b: number): Style {
    return makeStyle(`${ESC}[48;2;${r};${g};${b}m`, `${ESC}[49m`)
}
