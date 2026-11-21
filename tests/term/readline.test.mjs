/**
 * 验证我们依赖的 readline 私有 API 契约（Tab 补全 + 输入行回填）。
 *
 * Term.showCompletions() 用 printPrompt + state.reanchor，
 * Term.read(prompt, initial) 用"排一个空 write 再 updateLine"来等 readline
 * 把 state 建好 —— 都是非公开接口。升级 xterm-readline 后行为变了，这里先炸。
 *
 * 用 .mjs 而不是 .ts：@xterm/headless 是 CJS，且需要给 window 打桩，
 * 走 TS 要绕一堆类型，不值得。
 */
globalThis.window = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}

const { default: headless } = await import('@xterm/headless')
const { Readline } = await import('xterm-readline')
const { test } = await import('vitest')
const assert = (await import('node:assert/strict')).default

const { Terminal } = headless

const flush = (term) => new Promise((resolve) => term.write('', resolve))
const lines = (term) =>
    Array.from(
        { length: term.rows },
        (_, i) => term.buffer.active.getLine(i)?.translateToString(true) ?? '',
    ).filter((line) => line.trim() !== '')

async function setup() {
    const term = new Terminal({ cols: 40, rows: 10, allowProposedApi: true })
    // headless 没有 DOM 键盘接口，readline 装载时会调它
    term.attachCustomKeyEventHandler = () => {}
    const rl = new Readline()
    term.loadAddon(rl)
    rl.read('$ ').catch(() => {})
    await flush(term)
    return { term, rl }
}

const type = async (term, text) => {
    for (const char of text) term.input(char, true)
    await flush(term)
}

/**
 * 与 Term.showCompletions() 保持同一套调用顺序和去重规则。
 * 两份实现并存是没办法的事：Term 要 DOM 才能 open()，headless 起不来。
 * 这里一旦和 terminal.ts 不一致，本文件就会失去意义 —— 改动时请对照。
 */
const lastListed = new Map()

function showCompletions(term, rl, items) {
    const signature = `${rl.getLine()}\u0000${items.join('\u0000')}`
    if (lastListed.get(rl) === signature) return
    lastListed.set(rl, signature)

    rl.println('')
    for (const item of items) rl.println(item)
    rl.printPrompt(rl.activeRead.prompt, (tty) => rl.state.reanchor(tty))
}

test('列候选：候选打在输入行下面，提示符在候选之后再印一次', async () => {
    const { term, rl } = await setup()
    await type(term, 'ls bl')
    assert.deepEqual(lines(term), ['$ ls bl'])

    showCompletions(term, rl, ['blog/  blog/hello'])
    await flush(term)

    assert.deepEqual(lines(term), ['$ ls bl', 'blog/  blog/hello', '$ ls bl'])
    assert.equal(rl.getLine(), 'ls bl')
})

test('列完候选后继续输入，输入行仍然正确', async () => {
    const { term, rl } = await setup()
    await type(term, 'ls bl')
    showCompletions(term, rl, ['blog/  blog/hello'])
    await flush(term)

    await type(term, 'og/')
    assert.deepEqual(lines(term), ['$ ls bl', 'blog/  blog/hello', '$ ls blog/'])
    assert.equal(rl.getLine(), 'ls blog/')
})

test('列完候选后回车，命令行不会被候选污染', async () => {
    const { term, rl } = await setup()
    await type(term, 'ls')
    showCompletions(term, rl, ['blog/'])
    await flush(term)

    term.input('\r', true)
    await flush(term)

    // 回车后 readline 把输入提交出去，回显留在原输入行下面
    assert.deepEqual(lines(term).slice(0, 2), ['$ ls', 'blog/'])
})

test('多次列候选不会累积错位', async () => {
    const { term, rl } = await setup()
    await type(term, 'cd b')
    showCompletions(term, rl, ['blog/'])
    await flush(term)
    showCompletions(term, rl, ['blog/'])
    await flush(term)

    assert.deepEqual(lines(term), ['$ cd b', 'blog/', '$ cd b'])
    assert.equal(rl.getLine(), 'cd b')
})

/**
 * 回填的真实时序：read() 之后立刻排队是不行的 —— readline 的 printPrompt
 * 会排两层 write 才建 State，所以我们排的 write 插在中间，那时 state 还没有。
 * Term.prefill 是轮询到 printingPrompt 落回 false 再 updateLine，这里复刻同一套。
 */
async function prefillWhenReady(term, rl, text) {
    await new Promise((resolve) => {
        const tick = () => {
            if (rl.printingPrompt || rl.state === undefined) {
                setTimeout(tick, 0)
                return
            }
            rl.updateLine(text)
            resolve()
        }
        tick()
    })
    // updateLine 的重绘也是排队写出去的，等它落地
    await flush(term)
}

test('回填：内容进到输入行，光标在末尾', async () => {
    const { term, rl } = await setup()
    // setup 里已经 flush 过，这里重新开一次 read 模拟真实调用
    await prefillWhenReady(term, rl, 'ls blog')

    assert.deepEqual(lines(term), ['$ ls blog'])
    assert.equal(rl.getLine(), 'ls blog')
})

test('回填之后继续输入接在末尾', async () => {
    const { term, rl } = await setup()
    await prefillWhenReady(term, rl, 'ls blog')
    await type(term, ' --help')

    assert.deepEqual(lines(term), ['$ ls blog --help'])
    assert.equal(rl.getLine(), 'ls blog --help')
})

test('回填用的是未 flush 的真实时序，也要成功', async () => {
    globalThis.window = {
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
    const { default: headless } = await import('@xterm/headless')
    const { Readline } = await import('xterm-readline')

    const term = new headless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
    term.attachCustomKeyEventHandler = () => {}
    const rl = new Readline()
    term.loadAddon(rl)

    rl.read('$ ').catch(() => {})
    // 关键：不 flush，立刻按 Term.prefill 的方式等
    await prefillWhenReady(term, rl, 'theme github')
    await flush(term)

    assert.deepEqual(lines(term), ['$ theme github'])
    assert.equal(rl.getLine(), 'theme github')
})

test('高亮不会打乱屏幕内容和光标', async () => {
    globalThis.window = {
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
    const { default: headless } = await import('@xterm/headless')
    const { Readline } = await import('xterm-readline')
    const { highlightLine } = await import('@/render/highlight/line.ts')

    const term = new headless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
    term.attachCustomKeyEventHandler = () => {}
    const rl = new Readline()
    rl.setHighlighter({
        highlight: (line) =>
            highlightLine(line, {
                isCommand: (name) => name === 'ls',
                isAlias: () => false,
                resolvePath: () => 'dir',
            }),
        highlightPrompt: (prompt) => prompt,
        highlightChar: () => true,
    })
    term.loadAddon(rl)
    rl.read('$ ').catch(() => {})
    await flush(term)

    await type(term, 'ls -l blog/')

    // ANSI 只影响颜色，屏幕上的字符和光标位置都不该变
    assert.deepEqual(lines(term), ['$ ls -l blog/'])
    assert.equal(rl.getLine(), 'ls -l blog/')
    assert.equal(term.buffer.active.cursorX, 13) // "$ " + "ls -l blog/"
})

/**
 * 记录一下库的默认行为：回车前它会调 State.refreshUnhighlighted() 把这行重画成
 * 无样式，所以冻进 scrollback 的命令行不带颜色。
 *
 * 我们试过覆盖这个方法让颜色保留，后来觉得不值得动库的内部实现，撤掉了。
 * 这条用例留着是为了：哪天升级 xterm-readline 后行为变了，我们能立刻发现。
 */
test('回车之后这行会被重绘成无样式（库的默认行为）', async () => {
    globalThis.window = {
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
    const { default: headless } = await import('@xterm/headless')
    const { Readline } = await import('xterm-readline')

    const term = new headless.Terminal({ cols: 30, rows: 10, allowProposedApi: true })
    term.attachCustomKeyEventHandler = () => {}
    const rl = new Readline()
    rl.setHighlighter({
        highlight: (line) => `\x1b[36m${line}\x1b[39m`,
        highlightPrompt: (prompt) => prompt,
        highlightChar: () => true,
    })
    term.loadAddon(rl)

    rl.read('$ ').catch(() => {})
    await flush(term)
    await type(term, 'ls blog')

    // 输入过程中是青色（ANSI 36 → 调色板 6）
    assert.equal(term.buffer.active.getLine(0).getCell(2).getFgColor(), 6)

    term.input('\r', true)
    await flush(term)

    // 回车后颜色被清掉，但内容不变
    assert.equal(term.buffer.active.getLine(0).getCell(2).getFgColor(), -1)
    assert.equal(rl.getLine(), 'ls blog')
})
