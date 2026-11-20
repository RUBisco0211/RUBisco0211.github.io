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

/** 命令表，顺序即 `help` 里的列出顺序 */
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
