import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clampWindow, filterItems } from '../../src/term/select.ts'

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

test('筛选按 label 和 detail 做子串匹配，忽略大小写', () => {
    const items = [
        { value: 1, label: 'ls blog' },
        { value: 2, label: 'cat about', detail: '关于' },
        { value: 3, label: 'theme github' },
    ]
    assert.deepEqual(
        filterItems(items, 'cat').map((item) => item.value),
        [2],
    )
    assert.deepEqual(
        filterItems(items, 'GITHUB').map((item) => item.value),
        [3],
    )
    // 也能匹配 detail
    assert.deepEqual(
        filterItems(items, '关于').map((item) => item.value),
        [2],
    )
})

test('空筛选词返回全部', () => {
    const items = [{ value: 1, label: 'a' }]
    assert.equal(filterItems(items, '').length, 1)
    assert.equal(filterItems(items, '   ').length, 1)
})

test('没有匹配时返回空数组', () => {
    assert.deepEqual(filterItems([{ value: 1, label: 'a' }], 'zzz'), [])
})
