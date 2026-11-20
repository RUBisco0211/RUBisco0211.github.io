import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderInfo, type InfoLine } from '../../src/shell/commands/neofetch.ts'
import { stripAnsi, visibleWidth } from '../../src/render/width.ts'

const lines: InfoLine[] = [
    { kind: 'title', value: 'rubisco@tty.blog' },
    { kind: 'separator' },
    { kind: 'field', label: 'Name', value: 'RUBisco' },
    { kind: 'field', label: 'Loc', value: 'Nanjing' },
    { kind: 'separator' },
    { kind: 'field', label: 'Terminal', value: 'xterm.js 5.5.0' },
    { kind: 'field', label: 'Theme', value: 'dark' },
    { kind: 'separator' },
    { kind: 'field', label: 'Posts', value: '2 篇' },
    { kind: 'field', label: 'Tags', value: '3 个' },
]

const plain = (text: string): string => stripAnsi(text)

test('每张小表各自对齐自己的 label 列', () => {
    const out = renderInfo(lines).map(plain)
    const name = out.find((line) => line.startsWith('Name'))!
    const terminal = out.find((line) => line.startsWith('Terminal'))!
    const posts = out.find((line) => line.startsWith('Posts'))!

    // 个人表 label 列宽 = max('Name', 'Loc') = 4；终端表 = 8；站点表 = 5
    assert.equal(name.indexOf('RUBisco'), 4 + 2)
    assert.equal(terminal.indexOf('xterm.js'), 8 + 2)
    assert.equal(posts.indexOf('2 篇'), 5 + 2)
})

test('分隔线宽度一致，取整块最宽的表', () => {
    const out = renderInfo(lines).map(plain)
    const rules = out.filter((line) => line.startsWith('─'))
    assert.equal(rules.length, 3)
    const widths = rules.map(visibleWidth)
    assert.equal(new Set(widths).size, 1, `分隔线宽度应一致，实际 ${widths.join(', ')}`)
    // 最宽的是终端表：8 + 2 + 14（xterm.js 5.5.0）
    assert.equal(widths[0], 8 + 2 + 14)
})

test('超链接单元格按可见宽度对齐', () => {
    const withLink: InfoLine[] = [
        { kind: 'field', label: 'Blog', value: 'rublog-astro', href: 'https://example.com' },
        { kind: 'field', label: 'GitHub', value: 'RUBisco0211' },
    ]
    const out = renderInfo(withLink).map(plain)
    // 两行的值都从同一列开始
    assert.equal(out[0]!.indexOf('rublog-astro'), out[1]!.indexOf('RUBisco0211'))
})
