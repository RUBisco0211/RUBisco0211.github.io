import { catppuccin } from './themes/catppuccin.ts'
import { dracula } from './themes/dracula.ts'
import { github } from './themes/github.ts'
import { gruvbox } from './themes/gruvbox.ts'
import { kanagawa } from './themes/kanagawa.ts'
import { tokyo } from './themes/tokyo.ts'
import type { Theme } from './types.ts'

export type { Palette, Theme, ThemeCss } from './types.ts'
export { catppuccin, dracula, github, gruvbox, kanagawa, tokyo }

/** 顺序即 `theme` 命令里的列出顺序 */
export const themes: readonly Theme[] = [tokyo, catppuccin, kanagawa, gruvbox, dracula, github]

export function findTheme(name: string): Theme | undefined {
    const key = name.trim().toLowerCase()
    return themes.find((theme) => theme.name === key)
}
