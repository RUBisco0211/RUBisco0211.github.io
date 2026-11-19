import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocMeta } from '../../src/content/types.ts'
import { buildInfo, layout, renderInfo } from '../../src/shell/commands/neofetch.ts'
import { readFileSync } from 'node:fs'
import { visibleWidth } from '../../src/term/width.ts'

const doc = (slug: string, extra: Partial<DocMeta> = {}): DocMeta => ({
    slug,
    path: `${slug}.md`,
    title: slug,
    tags: [],
    chars: 0,
    kind: 'post',
    frontmatter: [],
    ...extra,
})

const docs: DocMeta[] = [
    doc('blog/a', { date: '2026-01-05', tags: ['Git'], chars: 1000 }),
    doc('blog/b', { date: '2026-04-06', tags: ['nvm', 'fnm'], chars: 1786 }),
    doc('projects/x', { kind: 'project', tags: ['Git'], chars: 3000 }),
]

const input = {
    docs,
    profile: [
        { label: 'Name', value: 'RUBisco' },
        { label: 'GitHub', value: 'RUBisco0211', href: 'https://github.com/RUBisco0211' },
    ],
    user: 'rubisco',
    host: 'tty.blog',
    theme: 'tokyo',
    font: 'Maple Mono NF',
    locale: 'zh-CN',
    cols: 100,
    rows: 30,
}

/** 从 public/assets 读真实的 art，保证它没被改坏 */
const ART = readFileSync(new URL('../../public/assets/neofetch-mona.txt', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line !== '')

const strip = (text: string): string =>
    text.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '').replace(/\x1b\[[0-9;]*m/g, '')

test('统计文章、项目、标签和最新日期', () => {
    const info = buildInfo(input)
    const text = info.map((line) => ('value' in line ? line.value : '')).join('\n')

    assert.match(text, /rubisco@tty\.blog/)
    assert.match(text, /2 篇/) // 只有 post 计入 Posts
    assert.match(text, /5786 字/)
    assert.match(text, /1 个/) // projects
    assert.match(text, /3 个/) // 去重后的标签数：Git / nvm / fnm
    assert.match(text, /2026-04-06/)
})

test('字数超过一万时用万字', () => {
    const many = [doc('blog/big', { chars: 45403 })]
    const text = buildInfo({ ...input, docs: many })
        .map((line) => ('value' in line ? line.value : ''))
        .join('\n')
    assert.match(text, /4\.5 万字/)
})

test('没有文章时 Latest 显示 -', () => {
    const text = buildInfo({ ...input, docs: [] })
        .map((line) => ('value' in line ? line.value : ''))
        .join('\n')
    assert.match(text, /-/)
})

test('个人信息排在内容统计之前，带 href 的渲染成 OSC 8 链接', () => {
    const info = buildInfo(input)
    const labels = info.flatMap((line) => (line.kind === 'field' ? [line.label] : []))
    assert.ok(labels.indexOf('Name') < labels.indexOf('Posts'))

    const github = info.find((line) => line.kind === 'field' && line.label === 'GitHub')!
    assert.equal(github.kind === 'field' && github.href, 'https://github.com/RUBisco0211')

    const rendered = renderInfo(info)
    assert.ok(
        rendered.some((line) => line.includes('\x1b]8;;https://github.com/RUBisco0211\x1b\\')),
    )
})

test('profile 为空时不留下多余的分隔线', () => {
    const lines = buildInfo({ ...input, profile: [] })
    const separators = lines.filter((line) => line.kind === 'separator').length
    assert.equal(separators, 2)
})

test('renderInfo 对齐标签并把分隔线撑满', () => {
    const lines = renderInfo(buildInfo(input)).map(strip)
    const separator = lines.find((line) => line.startsWith('─'))!
    const widest = Math.max(...lines.filter((line) => !line.startsWith('─')).map(visibleWidth))
    assert.equal(separator.length, widest)

    const field = lines.find((line) => line.startsWith('Terminal'))!
    assert.match(field, /^Terminal {2}xterm\.js \d+\.\d+\.\d+ · 100×30$/)
})

test('够宽时 art 和信息左右并排', () => {
    const info = renderInfo(buildInfo(input))
    const out = layout(ART, info, 120).map(strip)

    assert.equal(out.length, Math.max(ART.length, info.length))
    assert.match(out[0]!, /▄/)
    assert.match(out[0]!, /rubisco@tty\.blog/)
})

test('不够宽时 art 放到上面竖排', () => {
    const info = renderInfo(buildInfo(input))
    const out = layout(ART, info, 60).map(strip)

    assert.equal(out.length, ART.length + 1 + info.length)
    assert.equal(out[ART.length], '')
    assert.match(out[0]!, /▄/)
})

test('终端比 art 还窄时不画 art', () => {
    const info = renderInfo(buildInfo(input))
    const out = layout(ART, info, 30).map(strip)

    assert.equal(out.length, info.length)
    assert.doesNotMatch(out.join('\n'), /▄/)
})

test('硬编码的 xterm 版本和实际安装的一致', async () => {
    const { readFileSync } = await import('node:fs')
    const pkg = JSON.parse(
        readFileSync(
            new URL('../../node_modules/@xterm/xterm/package.json', import.meta.url),
            'utf8',
        ),
    ) as { version: string }
    const text = buildInfo(input)
        .map((line) => ('value' in line ? line.value : ''))
        .join('\n')
    assert.match(text, new RegExp(`xterm\\.js ${pkg.version.replace(/\./g, '\\.')} `))
})

test('art 资源是 10 行 45 列，且用的是 truecolor 原色', () => {
    assert.equal(ART.length, 10)
    assert.equal(Math.max(...ART.map(visibleWidth)), 45)
    // 不跟主题走的 GitHub 调色板
    assert.match(ART.join(''), /\x1b\[38;2;4;66;137m/)
    assert.match(ART.join(''), /\x1b\[38;2;255;248;242m/)
})
