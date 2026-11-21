import assert from 'node:assert/strict'
import { test } from 'vitest'
import { findTheme, themes } from '@/theme/index.ts'
import { config } from '@/config.ts'
import type { Palette } from '@/theme/types.ts'

const ANSI_KEYS = [
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'brightBlack',
    'brightRed',
    'brightGreen',
    'brightYellow',
    'brightBlue',
    'brightMagenta',
    'brightCyan',
    'brightWhite',
] as const

const HEX = /^#[0-9a-f]{6}$/i

const luma = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
    return 0.299 * r! + 0.587 * g! + 0.114 * b!
}

const palettes = (): Array<[string, 'light' | 'dark', Palette]> =>
    themes.flatMap((theme) => [
        [`${theme.name} (light)`, 'light', theme.light] as [string, 'light', Palette],
        [`${theme.name} (dark)`, 'dark', theme.dark] as [string, 'dark', Palette],
    ])

test('主题名唯一', () => {
    const names = themes.map((theme) => theme.name)
    assert.equal(new Set(names).size, names.length)
})

test('默认主题存在', () => {
    assert.ok(findTheme(config.defaultTheme))
})

test('findTheme 忽略大小写和空格', () => {
    assert.equal(findTheme('  TOKYO ')?.name, 'tokyo')
    assert.equal(findTheme('nope'), undefined)
})

test('每个变体都填齐 16 色和页面配色', () => {
    for (const [label, , palette] of palettes()) {
        assert.match(palette.pageBg, HEX, `${label} pageBg`)
        assert.match(palette.css.muted, HEX, `${label} muted`)
        assert.match(palette.css.accent, HEX, `${label} accent`)
        assert.match(String(palette.xterm.background), HEX, `${label} background`)
        assert.match(String(palette.xterm.foreground), HEX, `${label} foreground`)
        for (const key of ANSI_KEYS) {
            assert.match(String(palette.xterm[key]), HEX, `${label} ${key}`)
        }
    }
})

test('深色变体是深底浅字，浅色变体反过来', () => {
    for (const [label, mode, palette] of palettes()) {
        const bg = luma(palette.xterm.background!)
        const fg = luma(palette.xterm.foreground!)
        if (mode === 'dark') assert.ok(bg < fg, `${label} 应该是深底浅字`)
        else assert.ok(bg > fg, `${label} 应该是浅底深字`)
    }
})
