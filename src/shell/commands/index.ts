import type { Command } from '../types.ts'
import ansi from './ansi.ts'
import cat from './cat.ts'
import cd from './cd.ts'
import clear from './clear.ts'
import echo from './echo.ts'
import help from './help.ts'
import history from './history.ts'
import ls from './ls.ts'
import matrix from './matrix.ts'
import neofetch from './neofetch.ts'
import pwd from './pwd.ts'
import search from './search.ts'
import stats from './stats.ts'
import tags from './tags.ts'
import theme from './theme.ts'
import tree from './tree.ts'

/**
 * 命令表。手动注册：新增命令要在这里加一行 import + 数组项。
 *
 * 不用 `import.meta.glob` 自动收集 —— 那是 Vite 专属 API，node 测试里 import
 * 这个入口会直接报错；显式列表还能让 tsc 立刻发现漏接。
 */
export const commands: readonly Command[] = [
    ansi,
    cat,
    cd,
    clear,
    echo,
    help,
    history,
    ls,
    matrix,
    neofetch,
    pwd,
    search,
    stats,
    tags,
    theme,
    tree,
]
