import { green } from '../../term/ansi.ts'
import { select } from '../../term/select.ts'
import { fail } from '../error.ts'
import type { Command, Ctx } from '../types.ts'

/** 交互式选主题：移动即预览，Enter 记住，Esc 还原 */
async function pick(ctx: Ctx): Promise<void> {
    const original = ctx.theme.current()
    const names = ctx.theme.names()

    const picked = await select(ctx.term, {
        title: '选择主题',
        hint: `${ctx.theme.mode()} · 深浅跟随系统`,
        initial: Math.max(0, names.indexOf(original)),
        items: names.map((name) => ({ value: name, label: name })),
        onHighlight: (item) => {
            ctx.theme.preview(item.value)
        },
    })

    if (!picked) {
        ctx.theme.preview(original)
        return
    }

    ctx.theme.set(picked.value)
    ctx.term.println(green(`主题已切换为 ${picked.value}（${ctx.theme.mode()}）`))
}

const theme: Command = {
    name: 'theme',
    description: '切换主题',
    usage: 'theme [名字]',
    run(ctx, args) {
        const name = args[0]

        if (!name) {
            return pick(ctx)
        }

        if (ctx.theme.set(name)) {
            ctx.term.println(green(`主题已切换为 ${name}（${ctx.theme.mode()}）`))
            return
        }

        fail(`没有这个主题：${name}`, `可选：${ctx.theme.names().join(' / ')}`)
    },
}

export default theme
