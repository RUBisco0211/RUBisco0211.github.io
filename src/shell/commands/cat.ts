import { completePath } from '@/shell/complete.ts'
import { fail, printUsage } from '@/shell/error.ts'
import { lookup, type FileEntry } from '@/shell/fs.ts'
import { readDoc } from '@/utils/reader.ts'
import type { Command, Ctx } from '@/shell/types.ts'

export interface ResolvedDoc {
    readonly doc: FileEntry
    readonly text: string
}

/**
 * 解析参数、取回正文。
 * 参数或文件有问题时抛 ShellError，由 shell.run() 统一报错。
 */
async function resolveDoc(
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

const cat: Command = {
    name: 'cat',
    description: '阅读文档',
    usage: 'cat <文件>',
    complete: (ctx, _argv, current) => completePath(ctx, current),
    async run(ctx, args) {
        const { doc, text } = await resolveDoc(ctx, cat, args)
        await readDoc(ctx.term, doc, text)
    },
}

export default cat
