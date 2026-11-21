import assert from 'node:assert/strict'
import { test } from 'vitest'
import { Scroll, clampOffset } from '@/term/tui/scroll.ts'

test('clampOffset 夹在 [0, total - height]', () => {
    assert.equal(clampOffset(-5, 100, 10), 0)
    assert.equal(clampOffset(50, 100, 10), 50)
    assert.equal(clampOffset(999, 100, 10), 90)
    // 内容比一屏还短时固定在顶部
    assert.equal(clampOffset(5, 3, 10), 0)
})

test('scrollTo 返回是否真的动了', () => {
    const scroll = new Scroll({ total: 100, height: 10 })
    assert.equal(scroll.scrollTo(5), true)
    assert.equal(scroll.offset, 5)
    assert.equal(scroll.scrollTo(5), false)
    assert.equal(scroll.scrollTo(999), true)
    assert.equal(scroll.offset, 90)
})

test('page / half / top / bottom', () => {
    const scroll = new Scroll({ total: 100, height: 10 })
    assert.equal(scroll.pageDown(), true)
    assert.equal(scroll.offset, 10)
    assert.equal(scroll.halfDown(), true)
    assert.equal(scroll.offset, 15)
    assert.equal(scroll.bottom(), true)
    assert.equal(scroll.offset, 90)
    assert.equal(scroll.top(), true)
    assert.equal(scroll.offset, 0)
})

test('滚轮攒够一行才滚', () => {
    // 触控板 10 个 8px 的小事件 = 80px，正好滚一行
    const trackpad = new Scroll({ total: 100, height: 10, pixelsPerLine: 80 })
    let moved = false
    for (let i = 0; i < 10; i += 1) moved = trackpad.wheel(8) || moved
    assert.equal(moved, true)
    assert.equal(trackpad.offset, 1)

    // 鼠标一格 100px → 1.25 行：前三次各滚 1 行，第四次攒到 2 行
    const mouse = new Scroll({ total: 100, height: 10, pixelsPerLine: 80 })
    assert.equal(mouse.wheel(100), true)
    assert.equal(mouse.wheel(100), true)
    assert.equal(mouse.wheel(100), true)
    assert.equal(mouse.wheel(100), true)
    assert.equal(mouse.offset, 5)
})

test('滚轮 deltaMode 1（行）和 2（页）直接换算', () => {
    const lines = new Scroll({ total: 100, height: 10 })
    assert.equal(lines.wheel(4, 1), true)
    assert.equal(lines.offset, 4)

    const pages = new Scroll({ total: 1000, height: 10 })
    assert.equal(pages.wheel(1, 2), true)
    assert.equal(pages.offset, 10)
})

test('滚到头时丢掉余量，反向不空转', () => {
    const scroll = new Scroll({ total: 10, height: 10 })
    assert.equal(scroll.wheel(80), false)
    assert.equal(scroll.offset, 0)
    assert.equal(scroll.wheel(-80), false)
    assert.equal(scroll.offset, 0)
})

test('pageUp / halfUp 反向滚动', () => {
    const scroll = new Scroll({ total: 100, height: 10 })
    scroll.scrollTo(50)
    assert.equal(scroll.pageUp(), true)
    assert.equal(scroll.offset, 40)
    assert.equal(scroll.halfUp(), true)
    assert.equal(scroll.offset, 35)
})

test('setTotal / setHeight 会重新夹住 offset', () => {
    const scroll = new Scroll({ total: 100, height: 10 })
    scroll.scrollTo(90)
    assert.equal(scroll.total, 100)
    assert.equal(scroll.height, 10)

    scroll.setTotal(20)
    assert.equal(scroll.total, 20)
    assert.equal(scroll.offset, 10)

    scroll.setHeight(20)
    assert.equal(scroll.height, 20)
    assert.equal(scroll.offset, 0)
})
