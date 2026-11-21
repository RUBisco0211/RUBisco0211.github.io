import assert from 'node:assert/strict'
import { test } from 'vitest'
import { config } from '@/config.ts'
import type { ContentStore } from '@/content/store.ts'
import type { DocMeta } from '@/content/types.ts'
import cat from '@/shell/commands/cat.ts'
import cd from '@/shell/commands/cd.ts'
import ls from '@/shell/commands/ls.ts'
import pwd from '@/shell/commands/pwd.ts'
import { commonPrefix, completeLine, completePath } from '@/shell/complete.ts'
import { buildFs } from '@/shell/fs.ts'
import { createShell } from '@/shell/index.ts'
import type { Term } from '@/term/terminal.ts'
import type { ThemeStore } from '@/theme/store.ts'

const doc = (slug: string, title = slug): DocMeta => ({
    slug,
    path: `${slug}.md`,
    title,
    tags: [],
    chars: 0,
    kind: 'post',
    frontmatter: [],
})

const docs: DocMeta[] = [doc('about', '关于'), doc('blog/hello', 'Hello'), doc('blog/世界', '世界')]

const fakeContent: ContentStore = {
    docs,
    find: (slug) => docs.find((d) => d.slug === slug),
    text: async () => '',
}

const fakeTheme: ThemeStore = {
    names: () => ['tokyo'],
    current: () => 'tokyo',
    mode: () => 'dark',
    set: () => true,
    preview: () => true,
}

function setup(aliases: Record<string, string> = {}) {
    const term = { println: () => {} } as unknown as Term
    return createShell({
        term,
        theme: fakeTheme,
        config: { ...config, aliases },
        fs: buildFs(docs),
        content: fakeContent,
        commands: [cd, ls, cat, pwd],
        aliases,
    })
}

const values = (shell: ReturnType<typeof setup>, line: string) =>
    completeLine(shell.ctx, line).candidates.map((c) => c.value)

test('空行补出全部命令和别名', () => {
    const shell = setup({ ll: 'ls' })
    const all = values(shell, '')
    assert.ok(all.includes('cd'))
    assert.ok(all.includes('ls'))
    assert.ok(all.includes('ll'))
})

test('按前缀补命令', () => {
    const shell = setup()
    assert.deepEqual(values(shell, 'c'), ['cat', 'cd'])
})

test('命令后面的第一个参数交给命令补全', () => {
    const shell = setup()
    assert.deepEqual(values(shell, 'cd b'), ['blog/'])
})

test('别名后面也能补全', () => {
    const shell = setup({ g: 'cd blog' })
    assert.deepEqual(values(shell, 'g '), ['blog/', 'about'])
})

test('替换区间只覆盖当前 token', () => {
    const shell = setup()
    const result = completeLine(shell.ctx, 'cd bl')
    assert.equal(result.from, 3)
    assert.equal(result.to, 5)
    assert.deepEqual(
        result.candidates.map((c) => c.value),
        ['blog/'],
    )
})

test('completePath 处理子目录和 ~', () => {
    // 窄签名：不需要 createShell，只造 cwd + fs
    const scope = { cwd: '/', fs: buildFs(docs) }
    assert.deepEqual(
        completePath(scope, 'blog/').map((c) => c.value),
        ['blog/世界', 'blog/hello'],
    )
    assert.deepEqual(
        completePath(scope, '~/b').map((c) => c.value),
        ['~/blog/'],
    )
    assert.deepEqual(completePath(scope, 'nope/'), [])
})

test('completePath 在 cwd 内解析相对路径', () => {
    const scope = { cwd: '/blog', fs: buildFs(docs) }
    assert.deepEqual(
        completePath(scope, 'h').map((c) => c.value),
        ['hello'],
    )
    assert.deepEqual(
        completePath(scope, '../').map((c) => c.value),
        ['../blog/', '../about'],
    )
})

test('没有 complete 的命令不返回候选', () => {
    const shell = setup()
    assert.deepEqual(values(shell, 'pwd '), [])
})

test('commonPrefix', () => {
    assert.equal(commonPrefix(['blog/', 'blog/hello']), 'blog/')
    assert.equal(commonPrefix(['cat', 'cd']), 'c')
    assert.equal(commonPrefix(['abc']), 'abc')
    assert.equal(commonPrefix([]), '')
})
