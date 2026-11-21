import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterItems } from '../../../../src/term/tui/components/select.ts'
import { clampWindow } from '../../../../src/term/tui/list.ts'

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

test('空查询原样返回', () => {
    const items = [{ value: 'a', label: 'a' }]
    assert.deepEqual(filterItems(items, ''), items)
    assert.deepEqual(filterItems(items, '   '), items)
})

test('按 label 子串筛选，忽略大小写', () => {
    const items = [
        { value: 'tokyo', label: 'Tokyo Night' },
        { value: 'github', label: 'GitHub Dark' },
    ]
    assert.deepEqual(
        filterItems(items, 'tokyo').map((i) => i.value),
        ['tokyo'],
    )
    assert.deepEqual(
        filterItems(items, 'GITHUB').map((i) => i.value),
        ['github'],
    )
    assert.deepEqual(
        filterItems(items, 'night').map((i) => i.value),
        ['tokyo'],
    )
    assert.deepEqual(filterItems(items, 'zzz'), [])
})

test('也搜 detail', () => {
    const items = [
        { value: 'a', label: '标题', detail: '2026-04-06' },
        { value: 'b', label: '其他', detail: '标记 2025' },
    ]
    assert.deepEqual(
        filterItems(items, '2025').map((i) => i.value),
        ['b'],
    )
    assert.deepEqual(
        filterItems(items, '标题').map((i) => i.value),
        ['a'],
    )
})

test('label 和 detail 都命中时不重复', () => {
    const items = [{ value: 'a', label: '同样 2025', detail: '也是 2025' }]
    assert.deepEqual(
        filterItems(items, '2025').map((i) => i.value),
        ['a'],
    )
})
