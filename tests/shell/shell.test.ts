import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocMeta } from '../../src/content/types.ts'
import type { ContentStore } from '../../src/content/store.ts'
import cat from '../../src/shell/commands/cat.ts'
import cd from '../../src/shell/commands/cd.ts'
import ls from '../../src/shell/commands/ls.ts'
import pwd from '../../src/shell/commands/pwd.ts'
import search from '../../src/shell/commands/search.ts'
import { buildFs } from '../../src/shell/fs.ts'
import { createShell, type ShellDeps } from '../../src/shell/index.ts'
import { displayPath } from '../../src/shell/path.ts'
import type { Term } from '../../src/term/terminal.ts'
import type { ThemeStore } from '../../src/theme/store.ts'
import { config } from '../../src/config.ts'

const doc = (slug: string, extra: Partial<DocMeta> = {}): DocMeta => ({
  slug,
  path: `${slug}.md`,
  title: slug.split('/').pop() ?? slug,
  tags: [],
  chars: 0,
  kind: 'post',
  frontmatter: [],
  ...extra,
})

const docs: DocMeta[] = [
  doc('about', { kind: 'page' }),
  doc('blog/hello', { date: '2026-04-06', tags: ['nvm', 'fnm'], chars: 1786 }),
  doc('blog/世界', { chars: 554 }),
  doc('projects/unipac', {
    kind: 'project',
    title: 'UniPac',
    description: '一站式全局包管理器',
    frontmatter: [
      ['name', 'UniPac'],
      ['githubUrl', 'https://example.com/unipac'],
      ['star', '7'],
    ],
  }),
]

const texts = new Map([
  ['blog/hello', '# Hello\n\n第一段。'],
  ['blog/世界', '你好，世界。'],
  // project 只有 frontmatter，正文是空的
  ['projects/unipac', ''],
])

const fakeContent: ContentStore = {
  docs,
  find: (slug) => docs.find((d) => d.slug === slug),
  text: async (slug) => texts.get(slug),
}

const fakeTheme: ThemeStore = {
  names: () => ['tokyo'],
  current: () => 'tokyo',
  mode: () => 'dark',
  set: () => true,
  preview: () => true,
}

/** 去掉 SGR / OSC 8，行首锚定的断言用 */
const plain = (text: string): string =>
  text.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '').replace(/\x1b\[[0-9;]*m/g, '')

function setup(aliases: Record<string, string> = {}) {
  const lines: string[] = []
  const written: string[] = []
  const term = {
    println: (text = '') => void lines.push(text),
    write: (data: string) => void written.push(data),
    cols: 80,
    rows: 24,
    // pager 会接管键盘，这里直接模拟按 Esc 退出
    captureKeys: (handler: (event: KeyboardEvent) => void) => {
      queueMicrotask(() => handler({ key: 'Escape' } as KeyboardEvent))
      return () => {}
    },
    onResize: () => () => {},
  } as unknown as Term
  const deps: ShellDeps = {
    term,
    theme: fakeTheme,
    config,
    fs: buildFs(docs),
    content: fakeContent,
    commands: [cd, ls, cat, pwd, search],
    aliases,
  }
  const shell = createShell(deps)
  return { shell, lines, written, out: () => lines.join('\n') }
}

test('ls 在根目录列出目录', async () => {
  const { shell, out } = setup()
  await shell.run('ls')
  assert.match(out(), /blog\//)
})

test('ls 默认输出长格式：表头 + 类型/日期/字数/名称/标签', async () => {
  const { shell, out } = setup()
  await shell.run('ls blog')

  const lines = plain(out()).split('\n')
  assert.match(lines[0]!, /类型/)
  assert.match(lines[0]!, /日期/)
  assert.match(lines[0]!, /字数/)
  assert.match(lines[0]!, /名称/)
  assert.match(lines[0]!, /标签/)

  const hello = lines.find((line) => line.includes('hello'))!
  assert.match(hello, /post/)
  assert.match(hello, /2026-04-06/)
  assert.match(hello, /1\.8k/)
  assert.match(hello, /nvm fnm/)
})

test('ls 对目录用 - 占位，不编造日期和字数', async () => {
  const { shell, out } = setup()
  await shell.run('ls')
  const blog = plain(out())
    .split('\n')
    .find((line) => line.includes('blog/'))!
  assert.match(blog, /^dir\s+-\s+-\s+/)
})

test('ls 指向单个文件时只输出一行，不带表头', async () => {
  const { shell, out } = setup()
  await shell.run('ls blog/hello')
  const lines = plain(out()).split('\n')
  assert.equal(lines.length, 1)
  assert.match(lines[0]!, /2026-04-06/)
  assert.doesNotMatch(lines[0]!, /类型/)
})

test('cd 切换目录后 pwd 和 ls 跟着变', async () => {
  const { shell, out } = setup()
  await shell.run('cd blog')
  assert.equal(displayPath(shell.ctx.cwd), '~/blog')

  await shell.run('pwd')
  assert.equal(out().split('\n').pop(), '~/blog')

  await shell.run('ls')
  assert.match(out(), /hello/)
  assert.match(out(), /世界/)
})

test('cd .. 和 cd 无参数回根目录', async () => {
  const { shell } = setup()
  await shell.run('cd blog')
  await shell.run('cd ..')
  assert.equal(shell.ctx.cwd, '/')
  await shell.run('cd blog')
  await shell.run('cd')
  assert.equal(shell.ctx.cwd, '/')
})

test('cd 到文件或不存在的地方会报错且不移动', async () => {
  const { shell, out } = setup()
  await shell.run('cd blog/hello')
  assert.equal(shell.ctx.cwd, '/')
  assert.match(out(), /不是目录/)

  await shell.run('cd nope')
  assert.equal(shell.ctx.cwd, '/')
  assert.match(out(), /没有这个目录/)
})

test('cat 用整屏 pager 显示，进出 alternate screen', async () => {
  const { shell, written, out } = setup()
  await shell.run('cd blog')
  await shell.run('cat hello')

  const screen = written.join('')
  assert.match(screen, /\x1b\[\?1049h/)
  assert.match(screen, /\x1b\[\?1049l/)
  assert.match(screen, /第一段/)
  assert.equal(out(), '') // 不往 scrollback 里打东西
})

test('cat 支持 .md 后缀', async () => {
  const { shell, written } = setup()
  await shell.run('cd blog')
  await shell.run('cat hello.md')
  assert.match(written.join(''), /第一段/)
})

test('cat 到不存在的地方报错且不进 pager', async () => {
  const { shell, written, out } = setup()
  await shell.run('cat nope')
  assert.match(out(), /没有这个文件/)
  assert.equal(written.length, 0)
})

test('cat 没有参数时提示用法', async () => {
  const { shell, out, written } = setup()
  await shell.run('cat')
  assert.match(out(), /用法：cat <文件>/)
  assert.equal(written.length, 0)
})

test('正文为空的文档也能看，frontmatter 照样显示', async () => {
  const { shell, written } = setup()
  await shell.run('cat projects/unipac')
  const screen = written.join('')
  assert.match(screen, /UniPac/)
  assert.match(screen, /githubUrl/)
  assert.match(screen, /https:\/\/example\.com\/unipac/)
})

test('cat 目录会报错', async () => {
  const { shell, out } = setup()
  await shell.run('cat blog')
  assert.match(out(), /是目录/)
})

test('alias 展开成目标命令并追加参数', async () => {
  const { shell, out } = setup({ posts: 'ls blog', b: 'cd blog' })
  await shell.run('posts')
  assert.match(out(), /hello/)

  await shell.run('b')
  assert.equal(shell.ctx.cwd, '/blog')
})

test('search 命中正文并给出 snippet', async () => {
  const { shell, out } = setup()
  await shell.run('search 第一段')
  assert.match(out(), /1 条结果/)
  assert.match(out(), /hello/)
  assert.match(out(), /第一段/)
})

test('search 没有结果时提示', async () => {
  const { shell, out } = setup()
  await shell.run('search 不存在的词')
  assert.match(out(), /没有匹配/)
})

test('search 不带参数提示用法', async () => {
  const { shell, out } = setup()
  await shell.run('search')
  assert.match(out(), /用法/)
})

test('未知命令给出提示', async () => {
  const { shell, out } = setup()
  await shell.run('lss')
  assert.match(out(), /没有这个命令：lss/)
  assert.doesNotMatch(out(), /help/)
})
