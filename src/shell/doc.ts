import { lookup, type FileEntry } from './fs.ts'
import type { Command, Ctx } from './types.ts'
import { fail } from './error.ts'
import { printUsage } from './usage.ts'

export interface ResolvedDoc {
    readonly doc: FileEntry
    readonly text: string
}

/**
 * cat 用：解析参数、取回正文。
 * 参数或文件有问题时抛 ShellError，由 shell.run() 统一报错。
 */
export async function resolveDoc(
    ctx: Ctx,
    command: Command,
    args: readonly string[],
): Promise<ResolvedDoc> {
    const target = args[0]
    if (!target) printUsage(command)

    const found = lookup(ctx.fs, ctx.cwd, target)
    if (found.kind === 'missing') fail(`没有这个文件：${target}`)
    if (found.kind === 'dir') fail(`${target} 是目录，不是文件`)

    const text = await ctx.content.text(found.file.slug)
    if (text === undefined) fail(`正文加载失败：${target}`)

    return { doc: found.file, text }
}
