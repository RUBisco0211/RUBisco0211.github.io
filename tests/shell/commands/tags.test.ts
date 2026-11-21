import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { DocMeta } from '@/content/types.ts'
import { completeTags } from '@/shell/commands/tags.ts'

const doc = (slug: string, tags: string[]): DocMeta => ({
    slug,
    path: `${slug}.md`,
    title: slug,
    tags,
    chars: 0,
    kind: 'post',
    frontmatter: [],
})

const docs = [doc('a', ['terminal', 'misc']), doc('b', ['terminal']), doc('c', ['笔记'])]

test('补全标签名，带篇数说明', () => {
    assert.deepEqual(completeTags(docs, 'te'), [{ value: 'terminal', description: '2 篇' }])
})

test('忽略大小写', () => {
    assert.deepEqual(
        completeTags(docs, 'TE').map((item) => item.value),
        ['terminal'],
    )
})

test('空前缀返回全部，篇数多的在前', () => {
    const values = completeTags(docs, '').map((item) => item.value)
    assert.equal(values.length, 3)
    assert.equal(values[0], 'terminal')
})

test('没有匹配返回空', () => {
    assert.deepEqual(completeTags(docs, 'zzz'), [])
})
