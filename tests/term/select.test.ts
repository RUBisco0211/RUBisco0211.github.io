import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clampWindow } from '../../src/term/select.ts'

test('选中项在窗口内时不动', () => {
    assert.equal(clampWindow(3, 0, 5), 0)
    assert.equal(clampWindow(4, 0, 5), 0)
})

test('往上越界时窗口跟着上移', () => {
    assert.equal(clampWindow(2, 5, 5), 2)
})

test('往下越界时窗口跟着下移', () => {
    // 窗口 0..4，选中 5 → 窗口应该滑到 1..5
    assert.equal(clampWindow(5, 0, 5), 1)
    assert.equal(clampWindow(9, 0, 5), 5)
})

test('窗口高度为 1 时始终跟着选中项', () => {
    assert.equal(clampWindow(7, 0, 1), 7)
    assert.equal(clampWindow(0, 3, 1), 0)
})
