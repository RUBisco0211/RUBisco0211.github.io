import type { SiteConfig } from '../config.ts'
import type { ContentStore } from '../content/store.ts'
import type { Term } from '../term/terminal.ts'
import type { ThemeStore } from '../theme/store.ts'
import type { Fs } from './fs.ts'
import type { Registry } from './registry.ts'

/** 命令能看到的全部东西。命令不 import 具体实现，只吃这个上下文。 */
export interface Ctx {
  readonly term: Term
  readonly theme: ThemeStore
  readonly config: SiteConfig
  readonly fs: Fs
  readonly content: ContentStore
  readonly registry: Registry
  /** getter，永远反映 shell 当前目录 */
  readonly cwd: string
  /** 成功返回 null，失败返回错误消息 */
  chdir(target: string): string | null
}

export interface Completion {
  readonly value: string
  readonly description?: string
}

export interface Command {
  readonly name: string
  readonly description: string
  readonly usage?: string
  /** 参数补全。不给就只补命令名。 */
  complete?(ctx: Ctx, argv: string[], current: string): Completion[]
  run(ctx: Ctx, args: string[]): void | Promise<void>
}
