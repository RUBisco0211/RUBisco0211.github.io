import type { DocMeta } from '../../content/types.ts'
import { blue, bold, dim, hyperlink } from '../../render/ansi.ts'
import { formatChars } from '../../content/format.ts'
import { padEnd, visibleWidth } from '../../render/width.ts'
import type { Command } from '../types.ts'

export type InfoLine =
    | { readonly kind: 'title'; readonly value: string }
    | { readonly kind: 'separator' }
    | {
          readonly kind: 'field'
          readonly label: string
          readonly value: string
          readonly href?: string
      }

export interface ProfileItem {
    readonly label: string
    readonly value: string
    readonly href?: string
}

export interface InfoInput {
    readonly docs: readonly DocMeta[]
    readonly profile: readonly ProfileItem[]
    readonly user: string
    readonly host: string
    readonly theme: string
    readonly font: string
    readonly locale: string
    readonly cols: number
    readonly rows: number
}

const BASE = import.meta.env?.BASE_URL ?? '/'
const ART_URL = `${BASE}assets/neofetch-mona.txt`

/**
 * neofetch 的 ASCII art 放在 public/assets/ 里，运行时获取一次然后缓存
 * 跟 content/ 的正文一样按需取更合适；拉不到就只显示信息，不影响命令。
 */
let artCache: readonly string[] | undefined

async function loadArt(): Promise<readonly string[]> {
    if (artCache) return artCache
    try {
        const response = await fetch(ART_URL)
        if (!response.ok) return []
        const text = await response.text()
        artCache = text
            .split('\n')
            .map((line) => line.replace(/\s+$/, ''))
            .filter((line) => line !== '')
        return artCache
    } catch {
        return []
    }
}

/**
 * 硬编码的 xterm 版本号 —— 升级 @xterm/xterm 时要一起改。
 * 有测试拿它和 node_modules 里的实际版本对比，忘了改会红。
 */
const XTERM_VERSION = '5.5.0'

/** 站点内容统计，纯函数，方便单测 */
export function buildInfo(input: InfoInput): InfoLine[] {
    const posts = input.docs.filter((doc) => doc.kind === 'post')
    const projects = input.docs.filter((doc) => doc.kind === 'project')
    const tags = new Set(input.docs.flatMap((doc) => doc.tags))
    const chars = input.docs.reduce((sum, doc) => sum + doc.chars, 0)
    const latest = posts
        .map((doc) => doc.date ?? '')
        .sort()
        .at(-1)

    const lines: InfoLine[] = [
        { kind: 'title', value: `${input.user}@${input.host}` },
        { kind: 'separator' },
    ]

    for (const item of input.profile) {
        lines.push({ kind: 'field', label: item.label, value: item.value, href: item.href })
    }
    if (input.profile.length > 0) lines.push({ kind: 'separator' })

    lines.push(
        {
            kind: 'field',
            label: 'Terminal',
            value: `xterm.js ${XTERM_VERSION} · ${input.cols}×${input.rows}`,
        },
        { kind: 'field', label: 'Theme', value: input.theme },
        { kind: 'field', label: 'Font', value: input.font },
        { kind: 'field', label: 'Locale', value: input.locale },
        { kind: 'separator' },
        { kind: 'field', label: 'Posts', value: `${posts.length} 篇 · ${formatChars(chars)}` },
        { kind: 'field', label: 'Projects', value: `${projects.length} 个` },
        { kind: 'field', label: 'Tags', value: `${tags.size} 个` },
        { kind: 'field', label: 'Latest', value: latest || '-' },
    )

    return lines
}

/** 上色并对齐，分隔线按最宽的一行撑满 */
export function renderInfo(lines: readonly InfoLine[]): string[] {
    const fields = lines.filter((line) => line.kind === 'field')
    const labelWidth = Math.max(0, ...fields.map((field) => visibleWidth(field.label)))
    const values = lines.flatMap((line) =>
        line.kind === 'field' ? [line.value] : line.kind === 'title' ? [line.value] : [],
    )
    const valueWidth = Math.max(0, ...values.map(visibleWidth))
    const width = labelWidth + 2 + valueWidth

    return lines.map((line) => {
        if (line.kind === 'separator') return dim('─'.repeat(width))
        if (line.kind === 'title') return bold(line.value)
        const value = line.href ? hyperlink(line.href, blue(line.value)) : line.value
        return `${dim(padEnd(line.label, labelWidth))}  ${value}`
    })
}

/**
 * 排版：够宽就左右并排，不够就把 art 放上面竖排，
 * 终端比 art 还窄时干脆不画（让它折行只会糊成一团）。
 */
export function layout(
    art: readonly string[],
    info: readonly string[],
    cols: number,
    gap = 4,
): string[] {
    const artWidth = art.length > 0 ? Math.max(...art.map(visibleWidth)) : 0
    const infoWidth = info.length > 0 ? Math.max(...info.map(visibleWidth)) : 0

    if (artWidth === 0 || cols < artWidth) return [...info]
    if (cols < artWidth + gap + infoWidth) return [...art, '', ...info]

    const rows = Math.max(art.length, info.length)
    const out: string[] = []
    for (let i = 0; i < rows; i += 1) {
        out.push(`${padEnd(art[i] ?? '', artWidth)}${' '.repeat(gap)}${info[i] ?? ''}`)
    }
    return out
}

const neofetch: Command = {
    name: 'neofetch',
    description: '显示个人、站点与终端信息',
    async run(ctx) {
        const info = buildInfo({
            docs: ctx.content.docs,
            profile: ctx.config.profile,
            user: ctx.config.user,
            host: ctx.config.host,
            theme: `${ctx.theme.current()} (${ctx.theme.mode()})`,
            // 字体栈里第一个就是实际生效的族名
            font: ctx.config.fontFamily.split(',')[0]!.replace(/["']/g, '').trim(),
            locale: navigator.language,
            cols: ctx.term.cols,
            rows: ctx.term.rows,
        })

        const art = await loadArt()

        ctx.term.println()
        for (const line of layout(art, renderInfo(info), ctx.term.cols)) {
            ctx.term.println(line)
        }
        ctx.term.println()
    },
}

export default neofetch
