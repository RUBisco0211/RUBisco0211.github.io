import assert from 'node:assert/strict'
import { test } from 'vitest'
import { bar } from '@/render/chart.ts'

test('零或负值不出格子', () => {
    assert.equal(bar(0, 10, 5), '')
    assert.equal(bar(-1, 10, 5), '')
})

test('非零值至少一格，哪怕比例很小', () => {
    assert.equal(bar(1, 1000, 5), '█')
})

test('封顶在 width 格', () => {
    assert.equal(bar(10, 5, 5), '█████')
    assert.equal(bar(999, 10, 4), '████')
})

test('按比例四舍五入', () => {
    assert.equal(bar(5, 10, 10), '█████')
    assert.equal(bar(3, 10, 10), '███')
    assert.equal(bar(7, 10, 10), '███████')
})

test('width 为 0 或 max 非法时退回空串', () => {
    assert.equal(bar(5, 10, 0), '')
    assert.equal(bar(5, 0, 5), '')
})
