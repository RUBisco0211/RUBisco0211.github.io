import assert from 'node:assert/strict'
import { test } from 'vitest'
import { filterItems, SelectView } from '@/tui/views/select'
import { clampWindow } from '@/tui/components/list.ts'
import type { Canvas } from '@/tui/canvas.ts'

test('选中项在窗口内时不动', () => {
    assert.equal(clampWindow(3, 0, 5, 10), 0)
    assert.equal(clampWindow(4, 0, 5, 10), 0)
})

test('往上越界时窗口跟着上移', () => {
    assert.equal(clampWindow(2, 5, 5, 10), 2)
})

test('往下越界时窗口跟着下移', () => {
    // 窗口 0..4，选中 5 → 窗口应该滑到 1..5
    assert.equal(clampWindow(5, 0, 5, 10), 1)
    assert.equal(clampWindow(9, 0, 5, 10), 5)
})

test('窗口高度为 1 时始终跟着选中项', () => {
    assert.equal(clampWindow(7, 0, 1, 10), 7)
    assert.equal(clampWindow(0, 3, 1, 10), 0)
})

test('装得下时窗口固定在顶部', () => {
    assert.equal(clampWindow(4, 3, 10, 6), 0)
    assert.equal(clampWindow(0, 8, 10, 6), 0)
})

test('窗口末尾越界时被夹回列表底部', () => {
    assert.equal(clampWindow(7, 9, 5, 8), 3)
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

const items = Array.from({ length: 10 }, (_, index) => ({
    value: index,
    label: `item${index}`,
}))

const makeView = (
    onHighlight?: (item: { value: number }, index: number) => void,
    initial?: number,
): SelectView<number> =>
    new SelectView({
        title: 't',
        labels: { empty: '', footer: '' },
        items,
        initial,
        onHighlight,
    })

function fakeCanvas(rows: number, cols = 40) {
    const drawn: Array<{ row: number; text: string }> = []
    return {
        canvas: {
            rows,
            cols,
            put: (row: number, text: string) => void drawn.push({ row, text }),
            clear: () => {},
            status: () => {},
            write: () => {},
        } as unknown as Canvas,
        drawn,
    }
}

test('滚轮一格移动选中项，并回调 onHighlight', () => {
    const seen: number[] = []
    const view = makeView((_item, index) => seen.push(index))
    view.wheel(80, 0)
    assert.deepEqual(seen, [0, 1])
})

test('滚轮按像素累积，不足一行不动', () => {
    const seen: number[] = []
    const view = makeView((_item, index) => seen.push(index))
    // 小 delta 累积：80px 还不到一行，再补 40px 才到 120px
    view.wheel(40, 0)
    view.wheel(40, 0)
    assert.deepEqual(seen, [0])
    view.wheel(40, 0)
    assert.deepEqual(seen, [0, 1])
})

test('滚轮不会越过第一项', () => {
    const seen: number[] = []
    const view = makeView((_item, index) => seen.push(index))
    view.wheel(-80, 0)
    assert.deepEqual(seen, [0])
})

test('滚轮移动后，选中行始终在视口内', () => {
    const view = makeView()
    const { canvas, drawn } = fakeCanvas(6) // 可视区 = 6 - 3 = 3 行
    view.draw(canvas)

    for (let i = 0; i < 5; i += 1) view.wheel(80, 0)

    drawn.length = 0
    view.draw(canvas)
    // cyan() 会给 marker 和 label 各包一层 ANSI，按 label 找行、再看行里有没有 '>'
    const active = drawn.find((line) => line.text.includes('item5'))
    assert.ok(active, '选中项应被画出来')
    assert.ok(active.text.includes('>'))
    // 第 0 行是标题、最后一行是 footer，列表只占 1..3
    assert.ok(active.row >= 1 && active.row <= 3)
})

test('装得下时 initial 选中项不被顶到第一行', () => {
    const view = makeView(undefined, 4)
    const { canvas, drawn } = fakeCanvas(20) // 可视区 17 行，10 项全装得下
    view.draw(canvas)

    const active = drawn.find((line) => line.text.includes('item4'))
    assert.ok(active, '选中项应被画出来')
    assert.ok(active.text.includes('>'))
    // 标题占第 0 行，item4 应落在第 5 行（1 + 4）
    assert.equal(active.row, 5)
})

test('超出视口时 initial 选中项在视口内但不强制第一行', () => {
    const view = makeView(undefined, 4)
    const { canvas, drawn } = fakeCanvas(6) // 可视区 3 行
    view.draw(canvas)

    const active = drawn.find((line) => line.text.includes('item4'))
    assert.ok(active, '选中项应被画出来')
    assert.ok(active.text.includes('>'))
    // 选中项在窗口内，窗口不因 initial 而滚动：item4 落在最后一行（第 3 行）
    assert.equal(active.row, 3)

    // 往外越界才会滚：再往下两格，选中项被夹在视口最后一行
    view.wheel(80, 0)
    view.wheel(80, 0)
    drawn.length = 0
    view.draw(canvas)
    const scrolled = drawn.find((line) => line.text.includes('item6'))
    assert.ok(scrolled, '滚动后选中项应被画出来')
    assert.equal(scrolled.row, 3)
})
