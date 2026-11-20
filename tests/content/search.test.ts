import assert from 'node:assert/strict'
import { test } from 'node:test'
import { searchDocs } from '../../src/content/search.ts'
import type { ContentStore } from '../../src/content/store.ts'
import type { DocMeta } from '../../src/content/types.ts'

const doc = (slug: string, extra: Partial<DocMeta> = {}): DocMeta => ({
    slug,
    path: `${slug}.md`,
    title: slug.split('/').pop() ?? slug,
    tags: [],
    chars: 0,
    kind: 'post',
    frontmatter: [],
    ...extra,
})

const docs: DocMeta[] = [
    doc('blog/one', { title: 'Apple 指南', tags: ['fruit'], date: '2026-04-06' }),
    doc('blog/two', { title: 'Beta 手册', tags: ['notes'], date: '2026-01-05' }),
    doc('blog/three', { title: 'Gamma 笔记', tags: ['notes'], date: '2026-01-05' }),
]

const texts = new Map([
    ['blog/one', '这里讲苹果和梨的用法。'],
    ['blog/two', '这里提到 apple 这个词，还有香蕉。'],
    ['blog/three', '先读说明，再提改动。'],
])

const store: ContentStore = {
    docs,
    find: (slug) => docs.find((d) => d.slug === slug),
    text: async (slug) => texts.get(slug),
}

const slugs = async (query: string) => (await searchDocs(store, query)).map((hit) => hit.doc.slug)

test('空查询返回空', async () => {
    assert.deepEqual(await searchDocs(store, ''), [])
    assert.deepEqual(await searchDocs(store, '   '), [])
})

test('中文子串命中正文', async () => {
    assert.deepEqual(await slugs('苹果'), ['blog/one'])
    assert.deepEqual(await slugs('香蕉'), ['blog/two'])
})

test('命中标题', async () => {
    assert.deepEqual(await slugs('Beta'), ['blog/two'])
})

test('命中标签', async () => {
    const hits = await slugs('notes')
    assert.ok(hits.includes('blog/two'))
    assert.ok(hits.includes('blog/three'))
})

test('多个词是 AND', async () => {
    assert.deepEqual(await slugs('苹果 梨'), ['blog/one'])
    assert.deepEqual(await slugs('苹果 香蕉'), [])
})

test('大小写不敏感', async () => {
    assert.deepEqual(await slugs('BETA'), ['blog/two'])
    assert.ok((await slugs('APPLE')).includes('blog/one'))
})

test('标题命中排在正文命中前面', async () => {
    // apple 命中 blog/one 的标题，也命中 blog/two 的正文
    const hits = await searchDocs(store, 'apple')
    assert.equal(hits[0]?.doc.slug, 'blog/one')
})

test('snippet 包含关键词', async () => {
    const [hit] = await searchDocs(store, '苹果')
    assert.ok(hit)
    assert.match(hit.snippet, /苹果/)
})

test('长正文的 snippet 会截断并加省略号', async () => {
    const long = `${'前置内容。'.repeat(20)}关键词在这里。${'后续内容。'.repeat(20)}`
    const longStore: ContentStore = {
        docs: [doc('blog/long', { title: '长文' })],
        find: () => undefined,
        text: async () => long,
    }
    const [hit] = await searchDocs(longStore, '关键词')
    assert.ok(hit)
    assert.match(hit.snippet, /^…/)
    assert.match(hit.snippet, /…$/)
    assert.match(hit.snippet, /关键词/)
    assert.ok(hit.snippet.length < 90)
})

test('没有任何匹配', async () => {
    assert.deepEqual(await slugs('这个词不存在'), [])
})
