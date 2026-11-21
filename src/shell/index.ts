import type { SiteConfig } from '@/config.ts'
import type { ContentStore } from '@/content/store.ts'
import type { Term } from '@/term/terminal.ts'
import type { ThemeStore } from '@/theme/store.ts'
import { createAliasExpander, type AliasTable } from './alias.ts'
import { fail, ShellError } from './error.ts'
import { lookup, type Fs } from './fs.ts'
import { createRegistry } from './registry.ts'
import { tokenize } from './tokenize.ts'
import type { Command, Ctx } from './types.ts'

export interface ShellDeps {
    term: Term
    theme: ThemeStore
    config: SiteConfig
    fs: Fs
    content: ContentStore
    /** 命令表由调用方注入，方便测试，也避免 shell 依赖 glob */
    commands: readonly Command[]
    aliases?: AliasTable
}

export interface Shell {
    readonly ctx: Ctx
    run(line: string): Promise<void>
    /** 取出待回填的命令（取完即清空），交给下一次 term.read() */
    takePrefill(): string
}

/**
 * shell 本体：tokenize, alias 展开，查表，执行
 */
export function createShell(deps: ShellDeps): Shell {
    const registry = createRegistry(deps.commands)
    const expand = createAliasExpander(deps.aliases ?? {})
    let cwd = '/'
    let prefill = ''

    // 构建上下文对象
    const ctx: Ctx = {
        term: deps.term,
        theme: deps.theme,
        config: deps.config,
        fs: deps.fs,
        content: deps.content,
        registry,
        get cwd() {
            return cwd
        },
        chdir(target) {
            const found = lookup(deps.fs, cwd, target)
            if (found.kind === 'dir') {
                cwd = found.path
                return null
            }
            return found.kind === 'file' ? `不是目录：${target}` : `没有这个目录：${target}`
        },
        run(line) {
            return run(line)
        },
        prefill(line) {
            prefill = line
        },
    }

    // [NOTE] 处理并执行命令
    async function run(line: string): Promise<void> {
        // tokenize 并展开 alias
        const argv = expand(tokenize(line))
        const [head, ...args] = argv
        if (head === undefined) return

        try {
            // 查表匹配命令
            const command = registry.get(head)
            if (!command) fail(`没有找到命令 ${head}`)

            // 执行命令
            await command.run(ctx, args)
        } catch (error) {
            // [NOTE] 命令报 ShellError 在此处理，其他抛出给 main 处理
            if (!(error instanceof ShellError)) throw error
            deps.term.printError(error.message, error.hint)
        }
    }

    return {
        ctx,
        run,
        takePrefill() {
            const pending = prefill
            prefill = ''
            return pending
        },
    }
}
