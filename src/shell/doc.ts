import { red } from '../term/ansi.ts'
import { lookup, type FileEntry } from './fs.ts'
import type { Command, Ctx } from './types.ts'
import { printUsage } from './usage.ts'

export interface ResolvedDoc {
  readonly doc: FileEntry
  readonly text: string
}

/**
 * cat / open 共用：解析参数、报错、把正文取回来。
 * 返回 undefined 表示已经在终端里报过错，调用方直接 return 即可。
 */
export async function resolveDoc(
  ctx: Ctx,
  command: Command,
  args: readonly string[],
): Promise<ResolvedDoc | undefined> {
  const target = args[0]
  if (!target) {
    printUsage(ctx, command)
    return undefined
  }

  const found = lookup(ctx.fs, ctx.cwd, target)
  if (found.kind === 'missing') {
    ctx.term.println(red(`没有这个文件：${target}`))
    return undefined
  }
  if (found.kind === 'dir') {
    ctx.term.println(red(`${target} 是目录，不是文件`))
    return undefined
  }

  const text = await ctx.content.text(found.file.slug)
  if (text === undefined) {
    ctx.term.println(red(`正文加载失败：${target}`))
    return undefined
  }

  return { doc: found.file, text }
}
