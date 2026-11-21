import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enterFullscreen } from '../../../src/term/tui/screen.ts'
import type { Term } from '../../../src/term/terminal.ts'

/** 只实现 enterFullscreen 用到的部分，记录写出去的内容和监听器状态 */
function fakeTerm() {
    const writes: string[] = []
    let releasedKeys = false
    let releasedResize = false
    let resizeHandler: (() => void) | undefined
    const term = {
        write: (data: string) => void writes.push(data),
        captureKeys: () => () => {
            releasedKeys = true
        },
        onResize: (handler: () => void) => {
            resizeHandler = handler
            return () => {
                releasedResize = true
            }
        },
    } as unknown as Term
    return {
        term,
        writes,
        isReleased: () => releasedKeys && releasedResize,
        fireResize: () => resizeHandler?.(),
    }
}

test('进场切到 alternate screen', () => {
    const fake = fakeTerm()
    enterFullscreen(fake.term, { onKey: () => {} })
    assert.ok(fake.writes[0]?.includes('\x1b[?1049h'))
})

test('close 归还键盘、摘 resize、退出 alternate screen', () => {
    const fake = fakeTerm()
    const screen = enterFullscreen(fake.term, { onKey: () => {}, onResize: () => {} })
    screen.close()
    assert.ok(fake.isReleased())
    assert.ok(fake.writes.at(-1)?.includes('\x1b[?1049l'))
})

test('没给 onResize 时不注册 resize', () => {
    const fake = fakeTerm()
    const screen = enterFullscreen(fake.term, { onKey: () => {} })
    screen.close()
    // 只释放了键盘；没有 resize 监听需要摘
    assert.ok(fake.writes.at(-1)?.includes('\x1b[?1049l'))
})

test('resize 会防抖后回调一次', async () => {
    const fake = fakeTerm()
    let calls = 0
    enterFullscreen(fake.term, {
        onKey: () => {},
        onResize: () => void (calls += 1),
        resizeDebounce: 5,
    })
    fake.fireResize()
    fake.fireResize()
    fake.fireResize()
    assert.equal(calls, 0) // 还没到防抖时间
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(calls, 1) // 连发只回调一次
})
