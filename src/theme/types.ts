import type { ITheme } from '@xterm/xterm'

/** 给 DOM 层用的调色板。xterm 的 ITheme 只能喂给 xterm，CSS 读不到 */
export interface ThemeCss {
    readonly muted: string
    readonly accent: string
}

/** 一个主题在某个明暗模式下的具体配色 */
export interface Palette {
    readonly pageBg: string
    readonly css: ThemeCss
    readonly xterm: ITheme
}

/**
 * 一套主题，同时提供浅色和深色两个变体。
 *
 * 实际用哪个由 `prefers-color-scheme` 决定，所以切换主题时不用关心明暗，
 * 系统变了会自动跟着换。
 */
export interface Theme {
    readonly name: string
    readonly light: Palette
    readonly dark: Palette
}
