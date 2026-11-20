import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocMeta } from '../../src/content/types.ts'
import type { ContentStore } from '../../src/content/store.ts'
import cat from '../../src/shell/commands/cat.ts'
import cd from '../../src/shell/commands/cd.ts'
import history from '../../src/shell/commands/history.ts'
import { buildFs } from '../../src/shell/fs.ts'
import { ShellError } from '../../src/shell/error.ts'
import { createShell, type ShellDeps } from '../../src/shell/index.ts'
import { formatError } from '../../src/term/format.ts'
import type { Command } from '../../src/shell/types.ts'
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

const docs: DocMeta[] = [doc('blog/hello', { date: '2026-04-06' })]

const fakeContent: ContentStore = {
    docs,
    find: (slug) => docs.find((d) => d.slug === slug),
    text: async () => undefined,
}

const fakeTheme: ThemeStore = {
    names: () => ['plain'],
    current: () => 'plain',
    mode: () => 'dark',
    set: () => true,
    preview: () => true,
}

function setup(aliases: Record<string, string> = {}, extra: readonly Command[] = []) {
    const lines: string[] = []
    const keys = { next: 'Escape' }
    let historyEntries: string[] = []
    const term = {
        println: (text = '') => void lines.push(text),
        printError: (error: unknown, hint?: string) => void lines.push(formatError(error, hint)),
        write: () => {},
        cols: 80,
        rows: 24,
        // select 会接管键盘，这里直接模拟按键退出
        captureKeys: (handler: (event: KeyboardEvent) => void) => {
            queueMicrotask(() => handler({ key: keys.next } as KeyboardEvent))
            return () => {}
        },
        onResize: () => () => {},
        historyEntries: () => historyEntries,
        appendHistory: () => {},
        clearHistory: () => {},
    } as unknown as Term
    const deps: ShellDeps = {
        term,
        theme: fakeTheme,
        config,
        fs: buildFs(docs),
        content: fakeContent,
        commands: [cd, cat, history, ...extra],
        aliases,
    }
    return {
        shell: createShell(deps),
        keys,
        setHistory(next: string[]) {
            historyEntries = next
        },
    }
}

test('cd 到文件或不存在的地方不移动目录', async () => {
    const { shell } = setup()

    await shell.run('cd blog/hello')
    assert.equal(shell.ctx.cwd, '/')

    await shell.run('cd nope')
    assert.equal(shell.ctx.cwd, '/')
})

test('命令报错抛 ShellError，不自己打印', async () => {
    const { shell } = setup()
    const registry = shell.ctx.registry

    assert.throws(() => registry.get('cd')!.run(shell.ctx, ['nope']), ShellError)
    await assert.rejects(async () => registry.get('cat')!.run(shell.ctx, []), ShellError)
})

test('意外异常不会被当成用户错误吞掉', async () => {
    const boom = {
        name: 'boom',
        description: '故意抛 bug',
        run() {
            throw new Error('内部错误')
        },
    }
    const { shell } = setup({}, [boom])

    await assert.rejects(() => shell.run('boom'), /内部错误/)
})

test('history 选中后只回填提示符，不直接执行', async () => {
    const { shell, keys, setHistory } = setup()
    setHistory(['theme plain', 'ls blog'])
    keys.next = 'Enter'

    await shell.run('history')

    assert.equal(shell.takePrefill(), 'theme plain')
    assert.equal(shell.takePrefill(), '')
})
