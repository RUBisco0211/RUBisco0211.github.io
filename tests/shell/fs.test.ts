import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocMeta } from '../../src/content/types.ts'
import { allFiles, buildFs, findFile, isDir, lookup } from '../../src/shell/fs.ts'

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
    doc('about', { kind: 'page' }),
    doc('blog/从nvm迁移到fnm', { date: '2026-04-06' }),
    doc('blog/为开源项目贡献代码'),
    doc('blog/2026/hello'),
    doc('projects/unipac', { kind: 'project' }),
]

test('buildFs 逐级建出目录', () => {
    const fs = buildFs(docs)
    assert.deepEqual([...fs.keys()].sort(), ['/', '/blog', '/blog/2026', '/projects'])
    assert.deepEqual(fs.get('/')?.dirs, ['blog', 'projects'])
    assert.deepEqual(
        fs.get('/')?.files.map((f) => f.name),
        ['about'],
    )
    assert.deepEqual(fs.get('/blog')?.dirs, ['2026'])
    assert.deepEqual(
        fs.get('/blog/2026')?.files.map((f) => f.name),
        ['hello'],
    )
})

test('name 由 slug 最后一段决定', () => {
    const fs = buildFs([doc('blog/hello', { title: '标题' })])
    const file = fs.get('/blog')?.files[0]
    assert.equal(file?.name, 'hello')
    assert.equal(file?.title, '标题')
    assert.equal(file?.slug, 'blog/hello')
})

test('中文名按拼音排序', () => {
    const fs = buildFs(docs)
    const names = fs.get('/blog')?.files.map((f) => f.name) ?? []
    assert.deepEqual(names, ['从nvm迁移到fnm', '为开源项目贡献代码'])
})

test('isDir / findFile / allFiles', () => {
    const fs = buildFs(docs)
    assert.equal(isDir(fs, '/blog'), true)
    assert.equal(isDir(fs, '/nope'), false)
    assert.equal(findFile(fs, '/blog/2026/hello')?.slug, 'blog/2026/hello')
    assert.equal(findFile(fs, '/blog/nope'), undefined)
    assert.equal(allFiles(fs).length, 5)
})

test('lookup 相对 cwd 解析，并接受 .md 扩展名', () => {
    const fs = buildFs(docs)

    const dir = lookup(fs, '/', 'blog')
    assert.equal(dir.kind, 'dir')

    const file = lookup(fs, '/blog', '从nvm迁移到fnm')
    assert.equal(file.kind, 'file')
    if (file.kind === 'file') assert.equal(file.file.date, '2026-04-06')

    const nested = lookup(fs, '/blog', '2026/hello')
    assert.equal(nested.kind, 'file')

    const withExt = lookup(fs, '/blog/2026', 'hello.md')
    assert.equal(withExt.kind, 'file')

    const up = lookup(fs, '/blog/2026', '../../about')
    assert.equal(up.kind, 'file')

    const home = lookup(fs, '/blog', '~')
    assert.equal(home.kind, 'dir')

    const missing = lookup(fs, '/blog', 'nope')
    assert.equal(missing.kind, 'missing')
    if (missing.kind === 'missing') assert.equal(missing.path, '/blog/nope')
})

test('空输入指向 cwd', () => {
    const fs = buildFs(docs)
    const self = lookup(fs, '/blog', '.')
    assert.equal(self.kind, 'dir')
    if (self.kind === 'dir') assert.equal(self.path, '/blog')
})
