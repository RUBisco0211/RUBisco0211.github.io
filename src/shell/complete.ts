import { getNode } from './fs.ts'
import { resolvePath } from './path.ts'
import { tokenize } from './tokenize.ts'
import type { Completion, Ctx } from './types.ts'

export interface CompletionResult {
    readonly candidates: readonly Completion[]
    /** 当前 token 在整行里的起止位置，用于替换 */
    readonly from: number
    readonly to: number
}

const matches = (candidate: string, prefix: string): boolean =>
    candidate.toLowerCase().startsWith(prefix.toLowerCase())

/** 扫描光标所在 token 的边界 */
function scan(line: string): {
    tokens: string[]
    current: string
    from: number
    trailing: boolean
} {
    const trailing = /\s$/.test(line)
    const from = trailing ? line.length : line.search(/\S*$/)
    return {
        tokens: tokenize(line.slice(0, from)),
        current: line.slice(from),
        from,
        trailing,
    }
}

/**
 * 补全入口：给定整行，返回候选和替换区间。
 *
 * 第一个词补命令名 + alias；之后的词交给命令自己的 complete()。
 */
export function completeLine(ctx: Ctx, line: string): CompletionResult {
    const { tokens, current, from, trailing } = scan(line)
    const to = line.length

    // 只有还没敲完第一个词时才算在补命令名（行首、或行尾带空格都算下一段）
    const atCommand = tokens.length === 0 || (from === 0 && !trailing)
    if (atCommand) {
        const pool = [...ctx.registry.names(), ...Object.keys(ctx.config.aliases)]
        return {
            candidates: [...new Set(pool)]
                .filter((name) => matches(name, current))
                .map((value) => ({ value })),
            from,
            to,
        }
    }

    // head 可能是别名，展开一次再去查命令
    const head = ctx.config.aliases[tokens[0]!]
    const command = ctx.registry.get(head ? tokenize(head)[0]! : tokens[0]!)
    if (!command?.complete) return { candidates: [], from, to }

    return { candidates: command.complete(ctx, tokens.slice(1), current), from, to }
}

/**
 * 路径补全。cd / ls / cat 共用。
 *
 *   'bl'      →  [{ value: 'blog/' }]
 *   'blog/2'  →  [{ value: 'blog/2026/' }]
 *   '~/bl'    →  [{ value: '~/blog/' }]
 */
export function completePath(ctx: Ctx, current: string): Completion[] {
    const cut = current.lastIndexOf('/')
    const dirPart = cut === -1 ? '' : current.slice(0, cut + 1)
    const prefix = cut === -1 ? current : current.slice(cut + 1)

    const base = dirPart === '' ? ctx.cwd : resolvePath(ctx.cwd, dirPart)
    const node = getNode(ctx.fs, base)
    if (!node) return []

    const out: Completion[] = []
    for (const dir of node.dirs) {
        if (matches(dir, prefix)) out.push({ value: `${dirPart}${dir}/`, description: '目录' })
    }
    for (const file of node.files) {
        if (matches(file.name, prefix))
            out.push({ value: `${dirPart}${file.name}`, description: file.title })
    }
    return out
}

/** 最长公共前缀，bash 式的"补到不能再补为止" */
export function commonPrefix(values: readonly string[]): string {
    const first = values[0]
    if (first === undefined) return ''
    let end = first.length
    for (const value of values.slice(1)) {
        let i = 0
        while (i < end && i < value.length && value[i] === first[i]) i += 1
        end = i
    }
    return first.slice(0, end)
}
