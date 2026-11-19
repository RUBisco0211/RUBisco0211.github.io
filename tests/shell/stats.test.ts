import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocMeta } from '../../src/content/types.ts'
import { monthsOf, sizesOf, statsLines } from '../../src/shell/commands/stats.ts'
import { stripAnsi } from '../../src/term/width.ts'

const doc = (slug: string, extra: Partial<DocMeta> = {}): DocMeta => ({
    slug,
    path: `${slug}/index.md`,
    title: slug.split('/').pop() ?? slug,
    tags: [],
    chars: 0,
    kind: 'post',
    frontmatter: [],
    ...extra,
})

const docs: DocMeta[] = [
    doc('blog/a', { date: '2026-01-05', chars: 1000 }),
    doc('blog/b', { date: '2026-04-06', chars: 5000 }),
    doc('blog/c', { date: '2026-04-01', chars: 200 }),
    doc('projects/x', { kind: 'project', chars: 3000 }),
]

test('按月聚合，新的在前，只算文章', () => {
    assert.deepEqual(monthsOf(docs), [
        { month: '2026-04', count: 2 },
        { month: '2026-01', count: 1 },
    ])
})

test('篇幅排行按字数降序，名字只用最后一段', () => {
    const sizes = sizesOf(docs, 2)
    assert.deepEqual(sizes, [
        { name: 'b', chars: 5000 },
        { name: 'x', chars: 3000 },
    ])
})

test('summary 行里带上文章数、项目数和总字数', () => {
    const text = stripAnsi(statsLines(docs, 80).join('\n'))
    assert.match(text, /文章 3 篇/)
    assert.match(text, /项目 1 个/)
    assert.match(text, /9200 字/)
})

test('每个区块都有标题，柱子按同一列宽对齐', () => {
    const lines = stripAnsi(statsLines(docs, 80).join('\n')).split('\n')
    assert.ok(lines.includes('按月'))
    assert.match(lines.join('\n'), /篇幅 Top 3/)

    const monthRows = lines.filter((line) => /^\s+2026-\d\d/.test(line))
    const barColumns = monthRows.map((line) => line.indexOf('█'))
    assert.equal(new Set(barColumns).size, 1)
})

test('窄终端下柱子变短但仍有长度', () => {
    const narrow = stripAnsi(statsLines(docs, 40).join('\n'))
    const row = narrow.split('\n').find((line) => line.includes('2026-04'))!
    assert.match(row, /█/)
    assert.ok(row.length <= 40, row)
})
