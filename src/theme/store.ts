import type { Term } from '../term/terminal.ts'
import { readStored, writeStored } from '../storage.ts'
import { defaultThemeName, findTheme, themes } from './index.ts'

const NAME = 'theme'
/** 系统是否偏好浅色。主题自己不带明暗开关，跟着它走 */
const LIGHT_QUERY = '(prefers-color-scheme: light)'

export type ThemeMode = 'light' | 'dark'

export interface ThemeStore {
  names(): string[]
  current(): string
  /** 当前实际生效的明暗 */
  mode(): ThemeMode
  /** 切换主题并记住，返回 false 表示名字不认识 */
  set(name: string): boolean
  /** 只应用不落盘，用于实时预览 */
  preview(name: string): boolean
}

export function createThemeStore(term: Term, initial = defaultThemeName): ThemeStore {
  const media = window.matchMedia(LIGHT_QUERY)
  let current = findTheme(readStored(NAME) ?? '')?.name ?? initial

  const mode = (): ThemeMode => (media.matches ? 'light' : 'dark')

  const apply = (persist: boolean): void => {
    const theme = findTheme(current)
    if (!theme) return

    const palette = theme[mode()]
    term.setTheme(palette.xterm)

    const root = document.documentElement
    root.style.setProperty('--bg', palette.pageBg)
    root.style.setProperty('--muted', palette.css.muted)
    root.style.setProperty('--accent', palette.css.accent)
    root.style.colorScheme = mode()

    // 首屏占位页在 JS 起来之前就要用这两个颜色，所以顺手存一份
    if (!persist) return

    writeStored(NAME, theme.name)
    writeStored('bg', palette.pageBg)
    writeStored('muted', palette.css.muted)
  }

  // 系统在浅色/深色之间切换时自动跟着换
  media.addEventListener('change', () => apply(true))
  apply(true)

  return {
    names: () => themes.map((theme) => theme.name),
    current: () => current,
    mode,
    set(name: string) {
      const theme = findTheme(name)
      if (!theme) return false
      current = theme.name
      apply(true)
      return true
    },
    preview(name: string) {
      const theme = findTheme(name)
      if (!theme) return false
      current = theme.name
      apply(false)
      return true
    },
  }
}
