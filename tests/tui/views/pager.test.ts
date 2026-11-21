import assert from 'node:assert/strict'
import { test } from 'vitest'
import { cleanSelection, PagerView, progress } from '@/tui/views/pager.ts'
import type { TuiSession } from '@/tui/session.ts'

test('cleanSelection 去掉行尾空白和末尾换行', () => {
    // xterm 的 buffer 行是空格填充的，选到行尾会带一串空白
    assert.equal(cleanSelection('foo   \nbar  \n\n'), 'foo\nbar')
    assert.equal(cleanSelection('code\t\t\n'), 'code')
    // 段落中间的空行要保留
    assert.equal(cleanSelection('a\n\nb'), 'a\n\nb')
    // 选中纯空白时得到空串，调用方据此跳过复制
    assert.equal(cleanSelection('   \n\n'), '')
})

test('cleanSelection 不留 CRLF 的 \\r', () => {
    assert.equal(cleanSelection('foo\r\nbar\r\n'), 'foo\nbar')
    assert.equal(cleanSelection('foo \r\nbar\t\r\n'), 'foo\nbar')
})

test('progress 显示百分比和行范围', () => {
    assert.equal(progress(0, 100, 10), '10%  ·  1-10/100')
    assert.equal(progress(90, 100, 10), '100%  ·  91-100/100')
})

test('progress 内容不足一屏时算 100%', () => {
    assert.equal(progress(0, 3, 10), '100%  ·  1-3/3')
})

test('progress offset+height 超过 total 时封顶 100%', () => {
    assert.equal(progress(95, 100, 6), '100%  ·  96-100/100')
})

test('bindings 在浏览模式下、默认键未命中时触发', () => {
    let fired = 0
    const view = new PagerView({
        title: 'x',
        labels: { noMatch: (query) => query },
        render: () => [],
        bindings: {
            t: () => {
                fired += 1
            },
        },
    })

    view.key({ key: 't' } as KeyboardEvent, {} as TuiSession)
    assert.equal(fired, 1)
})

test('搜索模式下不触发 bindings（打字优先）', () => {
    let fired = 0
    const view = new PagerView({
        title: 'x',
        labels: { noMatch: (query) => query },
        render: () => [],
        bindings: {
            t: () => {
                fired += 1
            },
        },
    })

    view.key({ key: '/' } as KeyboardEvent, {} as TuiSession) // 进入搜索
    view.key({ key: 't' } as KeyboardEvent, {} as TuiSession) // t 应该被输入框吃掉
    assert.equal(fired, 0)
})

test('默认动作优先于 bindings', () => {
    let fired = 0
    const view = new PagerView({
        title: 'x',
        labels: { noMatch: (query) => query },
        render: () => [],
        bindings: {
            j: () => {
                fired += 1
            },
        },
    })

    view.key({ key: 'j' } as KeyboardEvent, {} as TuiSession) // j 是 down
    assert.equal(fired, 0)
})
