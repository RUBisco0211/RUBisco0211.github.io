import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayPath, normalize, resolvePath, splitPath } from '../../src/shell/path.ts'

test('normalize 折叠斜杠并处理 . 和 ..', () => {
    assert.equal(normalize('/'), '/')
    assert.equal(normalize('//a//b/'), '/a/b')
    assert.equal(normalize('/a/./b'), '/a/b')
    assert.equal(normalize('/a/b/../c'), '/a/c')
    assert.equal(normalize('/a/../..'), '/')
    assert.equal(normalize(''), '/')
})

test('resolvePath 处理 ~ / 相对路径', () => {
    assert.equal(resolvePath('/blog', ''), '/')
    assert.equal(resolvePath('/blog', '~'), '/')
    assert.equal(resolvePath('/blog', '~/x'), '/x')
    assert.equal(resolvePath('/blog', '/x'), '/x')
    assert.equal(resolvePath('/blog', 'x'), '/blog/x')
    assert.equal(resolvePath('/blog/2026', '..'), '/blog')
    assert.equal(resolvePath('/blog', '.'), '/blog')
    assert.equal(resolvePath('/blog', 'a/../../x'), '/x')
    assert.equal(resolvePath('/', 'blog/2026/'), '/blog/2026')
})

test('displayPath', () => {
    assert.equal(displayPath('/'), '~')
    assert.equal(displayPath('/blog'), '~/blog')
    assert.equal(displayPath('/blog/2026'), '~/blog/2026')
})

test('splitPath', () => {
    assert.deepEqual(splitPath('/'), { dir: '/', base: '' })
    assert.deepEqual(splitPath('/blog'), { dir: '/', base: 'blog' })
    assert.deepEqual(splitPath('/blog/2026/hello'), { dir: '/blog/2026', base: 'hello' })
})
