import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocMeta } from '../../src/content/types.ts'
import { buildFs } from '../../src/shell/fs.ts'
import { treeLines } from '../../src/shell/commands/tree.ts'

const doc = (slug: string): DocMeta => ({
    slug,
    path: `${slug}.md`,
    title: slug,
    tags: [],
    chars: 0,
    kind: 'post',
    frontmatter: [],
})

const strip = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const fs = buildFs([
    doc('about'),
    doc('blog/b'),
    doc('blog/a'),
    doc('blog/2026/nested'),
    doc('projects/x'),
])

test('根目录画出完整的树', () => {
    assert.deepEqual(treeLines(fs, '/').map(strip), [
        '~',
        '├── blog/',
        '│   ├── 2026/',
        '│   │   └── nested',
        '│   ├── a',
        '│   └── b',
        '├── projects/',
        '│   └── x',
        '└── about',
    ])
})

test('从子目录起画，根标签是相对路径', () => {
    assert.deepEqual(treeLines(fs, '/blog').map(strip), [
        '~/blog',
        '├── 2026/',
        '│   └── nested',
        '├── a',
        '└── b',
    ])
})

test('目录带颜色和斜杠，文件不带', () => {
    const lines = treeLines(fs, '/')
    const blog = lines.find((line) => line.includes('blog'))!
    assert.match(blog, /\x1b\[36mblog\/\x1b\[39m/)

    const about = lines.find((line) => line.includes('about'))!
    assert.doesNotMatch(about, /\x1b\[36m/)
})

test('最后一个子项用 └──，其余用 ├──', () => {
    const lines = treeLines(fs, '/').map(strip)
    assert.ok(lines.includes('├── blog/'))
    assert.ok(lines.includes('└── about'))
    // 收尾分支下面不再画竖线
    assert.ok(lines.includes('│   └── x'))
})
