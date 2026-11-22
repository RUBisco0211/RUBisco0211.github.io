import assert from 'node:assert/strict'
import { test } from 'vitest'
import { ListCursor } from '@/tui/components/list.ts'

test('move 夹在 [0, total-1]', () => {
    const list = new ListCursor({ total: 10, visible: 5 })
    assert.equal(list.move(-1), false)
    assert.equal(list.move(1), true)
    assert.equal(list.index, 1)
    assert.equal(list.move(100), true)
    assert.equal(list.index, 9)
})

test('窗口跟着光标走', () => {
    const list = new ListCursor({ total: 10, visible: 3 })
    assert.equal(list.move(4), true)
    assert.equal(list.index, 4)
    assert.equal(list.offset, 2)
})

test('setTotal 夹住光标', () => {
    const list = new ListCursor({ total: 10, visible: 5, initial: 9 })
    list.setTotal(3)
    assert.equal(list.index, 2)
})

test('setVisible 重算窗口', () => {
    const list = new ListCursor({ total: 10, visible: 2 })
    list.move(5)
    assert.equal(list.offset, 4)
    // 窗口变大后，index 5 仍在 [4, 9) 内，offset 不动
    list.setVisible(5)
    assert.equal(list.offset, 4)
})

test('setBounds 不让占位视口先把窗口钉到光标上', () => {
    // 构造时只拿得到占位视口 1 行，首次布局必须一次夹准
    const list = new ListCursor({ total: 10, visible: 1, initial: 4 })
    list.setBounds(10, 7)
    assert.equal(list.offset, 0)
    assert.equal(list.index, 4)
})

test('setBounds 装得下时窗口回到顶部', () => {
    const list = new ListCursor({ total: 10, visible: 3, initial: 9 })
    list.setBounds(10, 3)
    assert.equal(list.offset, 7) // 视口太矮，先跟着 initial 滚到底
    list.setBounds(10, 20)
    assert.equal(list.offset, 0) // 装得下就不再滚动
})

test('move 越界后窗口才滚动，选中项夹在边行', () => {
    const list = new ListCursor({ total: 10, visible: 3 })
    list.setBounds(10, 3)
    list.move(1)
    list.move(1)
    assert.equal(list.offset, 0) // 选中项（index 2）仍在窗口内，不滚
    list.move(1)
    assert.equal(list.offset, 1) // index 3 越界，窗口滑到 1..3，选中项在最后一行
    list.move(-1)
    assert.equal(list.offset, 1) // 回到窗口内，不滚
})

test('reset 回到第一项', () => {
    const list = new ListCursor({ total: 10, visible: 5 })
    list.move(5)
    list.reset()
    assert.equal(list.index, 0)
    assert.equal(list.offset, 0)
})

test('空列表 move 不动', () => {
    const list = new ListCursor({ total: 0, visible: 5 })
    assert.equal(list.move(1), false)
    assert.equal(list.index, 0)
})
