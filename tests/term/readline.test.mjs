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
const { test } = await import('node:test')
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

test('回填：提示符写完之后再 updateLine，能填进输入行', async () => {
  // setup 里已经开了一次 read()
  const { term, rl } = await setup()

  // 与 Term.read(prompt, initial) 同一套时序：read() 之后排一个空 write
  term.write('', () => rl.updateLine('ls blog'))
  await flush(term)

  assert.deepEqual(lines(term), ['$ ls blog'])
  assert.equal(rl.getLine(), 'ls blog')
})

test('回填之后继续输入接在末尾', async () => {
  const { term, rl } = await setup()
  term.write('', () => rl.updateLine('ls blog'))
  await flush(term)

  await type(term, ' --help')
  assert.deepEqual(lines(term), ['$ ls blog --help'])
  assert.equal(rl.getLine(), 'ls blog --help')
})
