import { dim, green } from '@/render/ansi.ts'
import { select } from '@/tui/views/select'
import type { Command } from '@/shell/types.ts'

const history: Command = {
    name: 'history',
    description: '浏览历史命令',
    usage: 'history [-c]',
    async run(ctx, args) {
        // `history -c` 清空历史
        if (args[0] === '-c') {
            ctx.term.clearHistory()
            ctx.term.println(green('历史已清空'))
            return
        }

        // `history` 全屏 select 查看历史
        const entries = ctx.term.historyEntries()
        if (entries.length === 0) {
            ctx.term.println(dim('无历史记录'))
            return
        }

        const picked = await select(ctx.term, {
            title: `历史 ${entries.length} 条`,
            labels: {
                empty: '无匹配',
                footer: '↑↓ 移动 · Enter 回填 · Esc 取消',
            },
            hint: '输入关键字筛选',
            filterable: true,
            items: entries.map((text) => ({ value: text, label: text })),
        })

        if (!picked) return

        // 只填到提示符里
        ctx.prefill(picked)
    },
}

export default history
