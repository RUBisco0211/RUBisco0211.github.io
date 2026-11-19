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
    doc('blog/从nvm迁移到fnm', {
        title: '从nvm迁移到fnm',
        tags: ['nvm', 'fnm'],
        date: '2026-04-06',
    }),
    doc('blog/管理自己的GitHub项目', {
        title: '管理自己的GitHub项目',
        tags: ['GitHub'],
        date: '2026-01-05',
    }),
    doc('blog/为开源项目贡献代码', {
        title: '为开源项目贡献代码',
        tags: ['Git'],
        date: '2026-01-05',
    }),
]

const texts = new Map([
    [
        'blog/从nvm迁移到fnm',
        '如果你使用 nvm 管理 Node.js 版本，每次打开新终端都会变慢。fnm 是 Rust 写的。',
    ],
    ['blog/管理自己的GitHub项目', '用标签和 Actions 管理版本发布流程。'],
    ['blog/为开源项目贡献代码', '先读 CONTRIBUTING，再提 PR。开源社区需要耐心。'],
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
    assert.deepEqual(await slugs('迁移'), ['blog/从nvm迁移到fnm'])
    assert.deepEqual(await slugs('耐心'), ['blog/为开源项目贡献代码'])
})

test('命中标题', async () => {
    assert.deepEqual(await slugs('GitHub'), ['blog/管理自己的GitHub项目'])
})

test('命中标签', async () => {
    // Git 既出现在标签里，也出现在正文里
    const hits = await slugs('Git')
    assert.ok(hits.includes('blog/为开源项目贡献代码'))
})

test('多个词是 AND', async () => {
    assert.deepEqual(await slugs('nvm fnm'), ['blog/从nvm迁移到fnm'])
    assert.deepEqual(await slugs('nvm 耐心'), [])
})

test('大小写不敏感', async () => {
    assert.deepEqual(await slugs('github'), ['blog/管理自己的GitHub项目'])
    assert.deepEqual(await slugs('NVM'), ['blog/从nvm迁移到fnm'])
})

test('标题命中排在正文命中前面', async () => {
    const hits = await searchDocs(store, 'fnm')
    assert.equal(hits[0]?.doc.slug, 'blog/从nvm迁移到fnm')
})

test('snippet 包含关键词', async () => {
    const [hit] = await searchDocs(store, '耐心')
    assert.ok(hit)
    assert.match(hit.snippet, /耐心/)
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
