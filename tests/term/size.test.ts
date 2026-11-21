import assert from 'node:assert/strict'
import { test } from 'vitest'
import { MIN_COLS, MIN_ROWS, sizeHint, tooSmall } from '@/term/size.ts'

test('正好到门槛不算小', () => {
    assert.equal(tooSmall(MIN_COLS, MIN_ROWS), false)
    assert.equal(tooSmall(MIN_COLS + 10, MIN_ROWS + 10), false)
})

test('任一维度不足就算小', () => {
    assert.equal(tooSmall(MIN_COLS - 1, MIN_ROWS), true)
    assert.equal(tooSmall(MIN_COLS, MIN_ROWS - 1), true)
    assert.equal(tooSmall(1, 1), true)
})

test('遮罩提示带上门槛尺寸', () => {
    const hint = sizeHint()
    assert.ok(hint.includes(`${MIN_COLS}×${MIN_ROWS}`))
})
