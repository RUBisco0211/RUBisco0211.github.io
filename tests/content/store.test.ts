import assert from 'node:assert/strict'
import { afterEach, test } from 'vitest'
import { createContentStore } from '@/content/store.ts'
import type { DocMeta } from '@/content/types.ts'

const doc = (slug: string, path: string): DocMeta => ({
    slug,
    path,
    title: slug,
    tags: [],
    chars: 0,
    kind: 'post',
    frontmatter: [],
})

const tree = {
    docs: [doc('blog/hello', 'blog/hello/index.md'), doc('about', 'about.md')],
}

const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})

function stubFetch(routes: Record<string, string>): string[] {
    const requested: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input)
        requested.push(url)
        const body = routes[url]
        if (body === undefined) return new Response('not found', { status: 404 })
        return new Response(body, { status: 200 })
    }) as typeof fetch
    return requested
}

test('按 doc.path 请求原始 markdown，并剥掉 frontmatter', async () => {
    const requested = stubFetch({
        '/content/blog/hello/index.md': '---\ntitle: hello\n---\n正文内容',
    })
    const store = createContentStore(tree)

    assert.equal(await store.text('blog/hello'), '正文内容')
    assert.deepEqual(requested, ['/content/blog/hello/index.md'])
})

test('路径里的中文会被编码', async () => {
    const requested = stubFetch({})
    const store = createContentStore({ docs: [doc('blog/中文', 'blog/中文/index.md')] })
    await store.text('blog/中文')
    assert.equal(requested[0], '/content/blog/%E4%B8%AD%E6%96%87/index.md')
})

test('同一篇只请求一次', async () => {
    const requested = stubFetch({ '/content/about.md': '关于' })
    const store = createContentStore(tree)
    await store.text('about')
    await store.text('about')
    assert.equal(requested.length, 1)
})

test('未知 slug 不发请求', async () => {
    const requested = stubFetch({})
    const store = createContentStore(tree)
    assert.equal(await store.text('nope'), undefined)
    assert.deepEqual(requested, [])
})

test('404 返回 undefined 且不缓存成空串', async () => {
    stubFetch({})
    const store = createContentStore(tree)
    assert.equal(await store.text('about'), undefined)
})

test('find 按 slug 取元数据', () => {
    const store = createContentStore(tree)
    assert.equal(store.find('blog/hello')?.path, 'blog/hello/index.md')
    assert.equal(store.find('nope'), undefined)
})
