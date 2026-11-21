import {
    blue,
    bold,
    dim,
    gray,
    green,
    inverse,
    italic,
    magenta,
    red,
    underline,
    white,
    yellow,
} from '@/render/ansi.ts'
import type { Command } from '@/shell/types.ts'

const ansi: Command = {
    name: 'ansi',
    description: '演示 ANSI 颜色与样式',
    run(ctx) {
        const palette = [
            red('红'),
            green('绿'),
            yellow('黄'),
            blue('蓝'),
            magenta('品'),
            gray('青'),
            white('白'),
            gray('灰'),
        ]
        const styles = [
            bold('粗体'),
            dim('暗色'),
            italic('斜体'),
            underline('下划线'),
            inverse('反显'),
        ]
        ctx.term.println(palette.join(' '))
        ctx.term.println(styles.join(' '))
    },
}

export default ansi
