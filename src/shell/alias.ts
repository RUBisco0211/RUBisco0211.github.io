import { tokenize } from './tokenize.ts'

export type AliasTable = Readonly<Record<string, string>>

/**
 * alias 展开：单层，纯 token 替换。
 *
 *   latest: 'ls blog --sort date'
 *   ['latest', '--limit', '3']  →  ['ls', 'blog', '--sort', 'date', '--limit', '3']
 *
 * 只展开一次 —— 目标命令本身如果也是别名，不会继续展开。
 * 不支持 $1 之类的占位符，也不支持链式别名。
 */
export function createAliasExpander(table: AliasTable): (argv: string[]) => string[] {
    const tokens = new Map(
        Object.entries(table).map(([name, value]) => [name, tokenize(value)] as const),
    )

    return function expand(argv: string[]): string[] {
        const head = argv[0]
        if (head === undefined) return argv

        const target = tokens.get(head)
        if (!target) return argv

        return [...target, ...argv.slice(1)]
    }
}
