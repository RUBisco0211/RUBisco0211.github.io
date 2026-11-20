import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocMeta } from '../../src/content/types.ts'
import { stripAnsi } from '../../src/render/width.ts'
import { tagBuckets, tagDocsLines, tagsLines } from '../../src/shell/commands/tags.ts'

const doc = (slug: string, tags: string[], extra: Partial<DocMeta> = {}): DocMeta => ({
    slug,
    path: `${slug}.md`,
    title: slug.split('/').pop() ?? slug,
    tags,
    chars: 1,
    kind: 'post',
    frontmatter: [],
    ...extra,
})

const docs = [
    doc('blog/a', ['rust', 'web'], { title: '甲文章', date: '2026-01-02' }),
    doc('blog/b', ['rust'], { title: '乙', date: '2026-02-02' }),
]

const plain = (lines: readonly string[]): string[] => lines.map(stripAnsi)

test('标签列表带表头', () => {
    const lines = plain(tagsLines(docs, 80))
    const header = lines.find((line) => line.includes('标签') && line.includes('篇数'))
    assert.ok(header, '应有一行同时出现“标签”和“篇数”')
    const rust = lines.find((line) => line.trimStart().startsWith('rust'))
    assert.ok(rust)
    // 标签列和数值列都对齐表头
    assert.equal(rust.indexOf('█') > header.indexOf('标签'), true)
    assert.equal(stripAnsi(rust).endsWith('2'), true)
})

test('标签下的文章列表带表头', () => {
    const bucket = tagBuckets(docs)[0]!
    const lines = plain(tagDocsLines(bucket, 80))
    const header = lines.find((line) => line.includes('日期') && line.includes('名称'))
    assert.ok(header, '应有一行同时出现“日期”和“名称”')
    const row = lines.find((line) => line.includes('2026-02-02'))
    assert.ok(row)
    // 日期列按表头宽度对齐
    assert.equal(row.indexOf('2026-02-02'), header.indexOf('日期'))
})

test('窄终端下表头与数据行右对齐', () => {
    const lines = plain(tagsLines(docs, 20))
    const header = lines.find((line) => line.includes('篇数'))!
    const row = lines.find((line) => line.trimStart().startsWith('rust'))!
    // 数值列右对齐：“篇数”和“2”都贴在行尾
    assert.ok(header.endsWith('篇数'))
    assert.ok(row.endsWith('2'))
})
