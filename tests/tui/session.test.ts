import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import type { TuiDriver } from '@/term/driver.ts'
import { TuiSession } from '@/tui/session.ts'
import type { TuiView } from '@/tui/view.ts'

/** 只实现 tui 用到的驱动面 */
function fakeDriver(cols = 80, rows = 24) {
    const writes: string[] = []
    const rowsDrawn: Array<{ row: number; text: string }> = []
    let releasedInput = 0
    let releasedResize = 0
    let keyHandler: ((event: KeyboardEvent) => void) | undefined
    let wheelHandler: ((deltaY: number, deltaMode: number) => void) | undefined
    let resizeHandler: (() => void) | undefined

    const driver: TuiDriver = {
        cols,
        rows,
        write: (data) => void writes.push(data),
        drawRow: (row, text) => void rowsDrawn.push({ row, text }),
        enterAltScreen: () => void writes.push('<alt-on>'),
        exitAltScreen: () => void writes.push('<alt-off>'),
        captureInput: (handlers) => {
            keyHandler = handlers.onKey
            wheelHandler = handlers.onWheel
            return () => {
                releasedInput += 1
            }
        },
        onResize: (handler) => {
            resizeHandler = handler
            return () => {
                releasedResize += 1
            }
        },
        hasSelection: () => false,
        getSelection: () => '',
        clearSelection: () => {},
        copy: async () => true,
    }

    return {
        driver,
        writes,
        rowsDrawn,
        fireKey: (event: KeyboardEvent) => keyHandler?.(event),
        fireWheel: (deltaY: number, deltaMode: number) => wheelHandler?.(deltaY, deltaMode),
        fireResize: () => resizeHandler?.(),
        released: () => releasedInput > 0 && releasedResize > 0,
    }
}

/** 一个可手动结束的视图，记录生命周期回调顺序 */
function fakeView(log: string[], name: string) {
    let settle!: () => void
    const done = new Promise<void>((resolve) => {
        settle = resolve
    })
    const view: TuiView = {
        done,
        draw: () => void log.push(`draw:${name}`),
        key: () => void log.push(`key:${name}`),
        wheel: () => void log.push(`wheel:${name}`),
        onShow: () => void log.push(`show:${name}`),
        onHide: () => void log.push(`hide:${name}`),
    }
    return { view, settle }
}

test('构造时进 alt screen 并接管输入', () => {
    const fake = fakeDriver()
    new TuiSession(fake.driver)
    assert.deepEqual(fake.writes, ['<alt-on>'])
})

test('open 挂视图并立即绘制，事件路由给栈顶', () => {
    const fake = fakeDriver()
    const log: string[] = []
    const session = new TuiSession(fake.driver)
    const root = fakeView(log, 'root')

    session.open(root.view)
    assert.deepEqual(log, ['show:root', 'draw:root'])

    fake.fireKey({ key: 'x' } as KeyboardEvent)
    fake.fireWheel(1, 0)
    assert.deepEqual(log, [
        'show:root',
        'draw:root',
        'key:root',
        'draw:root',
        'wheel:root',
        'draw:root',
    ])
})

test('子视图压栈盖住父视图，结束时自动弹回父视图', async () => {
    const fake = fakeDriver()
    const log: string[] = []
    const session = new TuiSession(fake.driver)
    const root = fakeView(log, 'root')
    session.open(root.view)

    const child = fakeView(log, 'child')
    session.open(child.view)

    assert.deepEqual(log, ['show:root', 'draw:root', 'hide:root', 'show:child', 'draw:child'])

    child.settle()
    await Promise.resolve()
    await Promise.resolve()

    // 弹栈：child 隐藏，root 恢复并重绘
    assert.deepEqual(log.slice(-3), ['hide:child', 'show:root', 'draw:root'])
    assert.equal(session.current(), root.view)
    // 栈里还有 root，会话不关
    assert.ok(!fake.writes.includes('<alt-off>'))
})

test('根视图结束：弹空栈并关闭会话', async () => {
    const fake = fakeDriver()
    const log: string[] = []
    const session = new TuiSession(fake.driver)
    const root = fakeView(log, 'root')
    session.open(root.view)

    root.settle()
    await Promise.resolve()
    await Promise.resolve()

    assert.ok(fake.writes.includes('<alt-off>'))
    assert.ok(fake.released())
    assert.equal(session.current(), undefined)
})

test('close 幂等：只归还一次、只退一次 alt screen', () => {
    const fake = fakeDriver()
    const session = new TuiSession(fake.driver)
    session.close()
    session.close()
    const offCount = fake.writes.filter((w) => w === '<alt-off>').length
    assert.equal(offCount, 1)
    assert.ok(fake.released())
})

test('close 之后 open 与重绘都不再发生', () => {
    const fake = fakeDriver()
    const session = new TuiSession(fake.driver)
    session.close()

    const log: string[] = []
    const root = fakeView(log, 'root')
    session.open(root.view)
    assert.deepEqual(log, [])
    assert.equal(fake.rowsDrawn.length, 0)
})

test('resize 防抖后重绘当前视图', async () => {
    const fake = fakeDriver()
    const log: string[] = []
    const session = new TuiSession(fake.driver)
    session.open(fakeView(log, 'root').view)
    const draws = log.filter((item) => item === 'draw:root').length

    fake.fireResize()
    fake.fireResize()
    fake.fireResize()
    assert.equal(log.filter((item) => item === 'draw:root').length, draws)
    await new Promise((resolve) => setTimeout(resolve, 120))
    assert.equal(log.filter((item) => item === 'draw:root').length, draws + 1)
    session.close()
})

test('flash 写右上角，到期重绘当前视图', () => {
    vi.useFakeTimers()
    try {
        const fake = fakeDriver(40, 10)
        const session = new TuiSession(fake.driver)
        const log: string[] = []
        session.open(fakeView(log, 'root').view)

        session.flash('ok', { duration: 500 })
        const out = fake.writes.at(-1) ?? ''
        // ' ok ' 宽 4，右上角 = 第 1 行、第 37 列
        assert.ok(out.includes('\x1b[1;37H'))
        assert.ok(out.includes('\x1b[7m'))

        const draws = log.filter((item) => item === 'draw:root').length
        vi.advanceTimersByTime(499)
        assert.equal(log.filter((item) => item === 'draw:root').length, draws)
        vi.advanceTimersByTime(1)
        assert.equal(log.filter((item) => item === 'draw:root').length, draws + 1)
    } finally {
        vi.useRealTimers()
    }
})
