import type { SiteConfig } from '../config.ts'
import type { ContentStore } from '../content/store.ts'
import { red } from '../term/ansi.ts'
import type { Term } from '../term/terminal.ts'
import type { ThemeStore } from '../theme/store.ts'
import { createAliasExpander, type AliasTable } from './alias.ts'
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
 * shell 本体：拆词 → alias 展开 → 查命令 → 执行。
 *
 * 没有管道、没有重定向、没有退出码。唯一的可变状态是 cwd。
 */
export function createShell(deps: ShellDeps): Shell {
  const registry = createRegistry(deps.commands)
  const expand = createAliasExpander(deps.aliases ?? {})
  let cwd = '/'
  let prefill = ''

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

  async function run(line: string): Promise<void> {
    const argv = expand(tokenize(line))
    const [head, ...args] = argv
    if (head === undefined) return

    const command = registry.get(head)
    if (!command) {
      deps.term.println(red(`没有这个命令：${head}`))
      return
    }

    await command.run(ctx, args)
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
