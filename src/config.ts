import { bold, dim } from './term/ansi.ts'

export interface SiteConfig {
    user: string
    host: string
    defaultTheme: string
    fontSize: number
    lineHeight: number
    fontFamily: string
    aliases: Record<string, string>
    startupMessage: string
    startupCommands: string[]
    profile: ReadonlyArray<{ label: string; value: string; href?: string }>
}

export const config: SiteConfig = {
    user: 'rubisco',
    host: 'tty.blog',
    defaultTheme: 'github',
    fontSize: 13,
    lineHeight: 1.1,
    fontFamily:
        '"Maple Mono NF", "Maple Mono", "Maple Mono NF CN", ui-monospace, "PingFang SC", "Microsoft YaHei", monospace',
    startupMessage: `${bold('tty.blog')} ${dim('— 输入 help 查看可用命令')}`,
    startupCommands: ['neofetch'],
    profile: [
        { label: 'Name', value: 'RUBisco' },
        { label: 'Location', value: 'Nanjing / Fuzhou' },
        { label: 'Blog', value: 'rublog-astro', href: 'https://rublog-astro.netlify.app/' },
        { label: 'GitHub', value: 'RUBisco0211', href: 'https://github.com/RUBisco0211' },
    ],
    aliases: {
        blog: 'ls blog',
        proj: 'ls projects',
        clr: 'clear',
        his: 'history',
    },
}
