import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { Screen } from '@/term/tui/screen.ts'
import type { Term } from '@/term/terminal.ts'

/** 只实现 Screen 用到的部分，记录写出去的内容和监听器状态 */
function fakeTerm(cols = 80, rows = 24) {
    const writes: string[] = []
    let releasedKeys = false
    let releasedResize = false
    let resizeHandler: (() => void) | undefined

    const term = {
        cols,
        rows,
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
        hasSelection: () => false,
        clearSelection: () => {},
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
    new Screen(fake.term, { onKey: () => {} })
    assert.ok(fake.writes[0]?.includes('\x1b[?1049h'))
})

test('put 攒行，flush 一次性写出去', () => {
    const fake = fakeTerm()
    const screen = new Screen(fake.term, { onKey: () => {} })
    screen.put(0, 'a')
    screen.put(1, 'b')
    screen.flush()

    const out = fake.writes.at(-1) ?? ''
    assert.ok(out.includes('a'))
    assert.ok(out.includes('b'))
    assert.ok(out.includes('\x1b[2K')) // ERASE_LINE
    // 第二次 flush 没有新内容，不重复写
    const before = fake.writes.length
    screen.flush()
    assert.equal(fake.writes.length, before)
})

test('status 画在最后一行', () => {
    const fake = fakeTerm(40, 10)
    const screen = new Screen(fake.term, { onKey: () => {} })
    screen.status({ left: 'x' })
    screen.flush()
    assert.ok(fake.writes.at(-1)?.includes('\x1b[10;1H'))
})

test('close 归还键盘、摘 resize、退出 alternate screen', () => {
    const fake = fakeTerm()
    const screen = new Screen(fake.term, { onKey: () => {}, onResize: () => {} })
    screen.close()
    assert.ok(fake.isReleased())
    assert.ok(fake.writes.at(-1)?.includes('\x1b[?1049l'))
})

test('resize 会防抖后回调一次', async () => {
    const fake = fakeTerm()
    let calls = 0
    new Screen(fake.term, {
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

test('flash 默认右上角、反显', () => {
    const fake = fakeTerm(40, 10)
    const screen = new Screen(fake.term, { onKey: () => {} })
    screen.flash('ok')
    const out = fake.writes.at(-1) ?? ''
    // ' ok ' 宽 4，右上角 = 第 1 行、第 37 列
    assert.ok(out.includes('\x1b[1;37H'))
    assert.ok(out.includes('\x1b[7m'))
})

test('flash 位置/样式/时长可配，到期后恢复', () => {
    vi.useFakeTimers()
    try {
        const fake = fakeTerm(40, 10)
        const screen = new Screen(fake.term, { onKey: () => {} })
        let restored = false

        screen.flash('ok', {
            position: 'bottom-left',
            duration: 500,
            paint: (text) => `<${text}>`,
            restore: () => {
                restored = true
            },
        })

        const out = fake.writes.at(-1) ?? ''
        assert.ok(out.includes('\x1b[10;1H')) // 左下角
        assert.ok(out.includes('< ok >'))

        vi.advanceTimersByTime(499)
        assert.equal(restored, false)
        vi.advanceTimersByTime(1)
        assert.equal(restored, true)
    } finally {
        vi.useRealTimers()
    }
})

test('close 会取消未到期的 flash', () => {
    vi.useFakeTimers()
    try {
        const fake = fakeTerm(40, 10)
        const screen = new Screen(fake.term, { onKey: () => {} })
        let restored = false
        screen.flash('ok', {
            restore: () => {
                restored = true
            },
        })
        screen.close()
        vi.advanceTimersByTime(5000)
        assert.equal(restored, false)
    } finally {
        vi.useRealTimers()
    }
})
