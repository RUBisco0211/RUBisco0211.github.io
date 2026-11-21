import { bold, cyan, dim } from '@/render/ansi.ts'
import { columnWidths, formatRow } from '@/render/table.ts'
import { fail } from '@/shell/error.ts'
import type { Command } from '@/shell/types.ts'

const help: Command = {
    name: 'help',
    description: '列出可用命令，或查看某条命令的用法',
    usage: 'help [命令]',
    run(ctx, args) {
        const wanted = args[0]

        // `help cmd` 显示某条命令的用法
        if (wanted) {
            const command = ctx.registry.get(wanted)
            if (!command) {
                fail(`没有这个命令：${wanted}`)
            }
            ctx.term.println(`${bold(command.name)}  ${command.description}`)
            if (command.usage) ctx.term.println(dim(`用法：${command.usage}`))
            return
        }

        // `help` 显示所有命令列表
        const list = ctx.registry.list()
        // 第一列直接放 usage
        const label = (command: Command): string => command.usage ?? command.name
        const rows = list.map(
            (command) => [cyan(label(command)), dim(command.description)] as const,
        )
        const widths = columnWidths(rows)

        ctx.term.println(bold('可用命令'))
        for (const row of rows) ctx.term.println(`  ${formatRow(row, widths)}`)

        const aliases = Object.entries(ctx.config.aliases)
        if (aliases.length > 0) {
            ctx.term.println()
            ctx.term.println(bold('别名'))
            for (const [name, expansion] of aliases) {
                const row = [cyan(name), dim(`→ ${expansion}`)]
                ctx.term.println(`  ${formatRow(row, widths)}`)
            }
        }

        ctx.term.println()
    },
}

export default help
