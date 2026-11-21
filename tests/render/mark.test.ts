import assert from 'node:assert/strict'
import { test } from 'vitest'
import { markMatches, matchesQuery } from '@/render/mark.ts'

test('没有关键字时原样返回', () => {
    const line = '\x1b[36mls blog\x1b[39m'
    assert.equal(markMatches(line, ''), line)
})

test('匹配片段反显，其余不动', () => {
    const out = markMatches('ls blog', 'blog')
    assert.equal(out, `ls \x1b[7mblog\x1b[27m`)
    // 独立去色，不依赖被测模块自己的 stripAnsi
    assert.equal(out.replace(/\x1b\[[0-9;]*m/g, ''), 'ls blog')
})

test('带颜色的行里插反显不会打乱样式序列', () => {
    const out = markMatches('\x1b[36mls blog\x1b[39m', 'ls')
    assert.equal(out.replace(/\x1b\[[0-9;]*m/g, ''), 'ls blog')
    assert.match(out, /^\x1b\[36m\x1b\[7mls\x1b\[27m/)
})

test('一行里多处匹配都标出来', () => {
    const out = markMatches('a b a b', 'a')
    assert.equal(out.replace(/\x1b\[[0-9;]*m/g, ''), 'a b a b')
    assert.equal((out.match(/\x1b\[7m/g) ?? []).length, 2)
})

test('忽略大小写', () => {
    assert.match(markMatches('LS Blog', 'ls'), /\x1b\[7mLS\x1b\[27m/)
})

test('matchesQuery 判断是否命中（忽略 ANSI 和大小写）', () => {
    assert.equal(matchesQuery('\x1b[36mls blog\x1b[39m', 'blog'), true)
    assert.equal(matchesQuery('\x1b]8;;https://a\x1b\\BLOG\x1b]8;;\x1b\\', 'blog'), true)
    assert.equal(matchesQuery('ls blog', 'nope'), false)
    assert.equal(matchesQuery('ls', '  '), false)
})
