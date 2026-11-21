import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ListCursor } from '../../../src/term/tui/list.ts'

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
