import assert from 'node:assert/strict'
import { test } from 'vitest'
import { formatChars, formatCount } from '@/content/format.ts'

test('formatCount 小于一千原样显示', () => {
    assert.equal(formatCount(1), '1')
    assert.equal(formatCount(999), '999')
})

test('formatCount 进位边界：9999 不能显示成 10.0k', () => {
    assert.equal(formatCount(9999), '10k')
    assert.equal(formatCount(1000), '1.0k')
    assert.equal(formatCount(1786), '1.8k')
    assert.equal(formatCount(9999.9), '10k')
})

test('formatCount 万级以上取整', () => {
    assert.equal(formatCount(10000), '10k')
    assert.equal(formatCount(18000), '18k')
    assert.equal(formatCount(99999), '100k')
})

test('formatCount 非正数显示占位', () => {
    assert.equal(formatCount(0), '-')
    assert.equal(formatCount(-5), '-')
})

test('formatChars 万字边界不进位成 10.0 万字', () => {
    assert.equal(formatChars(9999), '9999 字')
    assert.equal(formatChars(10000), '1.0 万字')
    assert.equal(formatChars(45403), '4.5 万字')
    assert.equal(formatChars(99999), '10 万字')
})

test('formatChars 十万字以上取整，不带小数', () => {
    assert.equal(formatChars(120000), '12 万字')
    assert.equal(formatChars(999999), '100 万字')
})
