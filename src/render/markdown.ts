/**
 * markdown → ANSI。
 *
 * 只做终端里看得懂的那一层：标题去掉 #、列表加符号、代码块按语言着色、
 * 链接保留文字（OSC 8 可点）、图片做成可点链接、表格按列宽折行对齐。
 *
 * 不折行 —— xterm 自己会按列宽折，自己算折行还要处理 CJK 宽度，不值。
 * 颜色全部走 render/ansi.ts，跟着主题走。
 */

import { marked } from 'marked'
import type { Token, Tokens } from 'marked'
import { blue, bold, cyan, dim, hyperlink, italic, magenta, yellow } from './ansi.ts'
import { wrapAnsi } from './wrap.ts'
import { padEnd, stripAnsi, visibleWidth } from './width.ts'
import { highlightCode, normalizeLang } from './highlight.ts'

const link = (href: string, text: string): string => hyperlink(href, blue(text))

/** 图片没写 alt 时，用 URL 最后一段当标签 */
function lastSegment(href: string): string {
    const clean = href.split(/[?#]/)[0] ?? href
    return clean.split('/').filter(Boolean).at(-1) ?? href
}

function inline(tokens: Token[] | undefined): string {
    if (!tokens) return ''
    return tokens.map(inlineToken).join('')
}

function inlineToken(token: Token): string {
    switch (token.type) {
        case 'strong':
            return bold(inline((token as Tokens.Strong).tokens))
        case 'em':
            return italic(inline((token as Tokens.Em).tokens))
        case 'del':
            return dim(inline((token as Tokens.Del).tokens))
        case 'codespan':
            return yellow((token as Tokens.Codespan).text)
        case 'br':
            return '\n'
        case 'link': {
            const lk = token as Tokens.Link
            return link(lk.href, inline(lk.tokens) || lk.href)
        }
        case 'image': {
            const im = token as Tokens.Image
            // 图片没法在字符网格里画，做成可点链接：点开看原图
            const label = im.text || lastSegment(im.href)
            return hyperlink(im.href, blue(`[图片: ${label}]`))
        }
        case 'text': {
            const tx = token as Tokens.Text
            return tx.tokens ? inline(tx.tokens) : tx.text
        }
        case 'escape':
            return (token as Tokens.Escape).text
        default: {
            const anyToken = token as { text?: string }
            return anyToken.text ?? ''
        }
    }
}

function block(token: Token, width: number, indent = ''): string {
    switch (token.type) {
        case 'heading': {
            const heading = token as Tokens.Heading
            const text = inline(heading.tokens)
            if (heading.depth <= 2) return `\n${bold(cyan(text))}\n`
            if (heading.depth === 3) return `\n${bold(magenta(text))}\n`
            return `\n${bold(dim(text))}\n`
        }

        case 'paragraph':
            return `${inline((token as Tokens.Paragraph).tokens)}\n\n`

        case 'list': {
            const list = token as Tokens.List
            const lines = list.items.map((item, index) => {
                const marker = list.ordered ? `${(list.start || 1) + index}. ` : `${cyan('•')} `
                const body = item.tokens
                    .map((child) => block(child, width, ''))
                    .join('')
                    .replace(/\n{2,}/g, item.loose ? '\n\n' : '\n')
                    .trimEnd()
                const [first = '', ...rest] = body.split('\n')
                // 悬挂缩进要按 marker 的显示宽度算，'• ' 是 2 列
                const pad = ' '.repeat(list.ordered ? marker.length : 2)
                return `${indent}  ${marker}${first}${rest
                    .map((line) => `\n${indent}  ${pad}${line}`)
                    .join('')}`
            })
            return `${lines.join('\n')}\n\n`
        }

        case 'code': {
            const code = token as Tokens.Code
            const body = code.text.replace(/\n$/, '')
            const highlighted = highlightCode(body, normalizeLang(code.lang))
            return `${highlighted
                .split('\n')
                .map((line) => `${indent}${line}`)
                .join('\n')}\n\n`
        }

        case 'blockquote': {
            const quote = token as Tokens.Blockquote
            const body = (quote.tokens ?? [])
                .map((child) => block(child, width, ''))
                .join('')
                .trimEnd()
            return `${body
                .split('\n')
                .map((line) => `${dim('│')} ${dim(line)}`)
                .join('\n')}\n\n`
        }

        case 'hr':
            return `${dim('─'.repeat(40))}\n\n`

        case 'table':
            return renderTable(token as Tokens.Table, width)

        case 'text': {
            const text = token as Tokens.Text
            return `${inline(text.tokens) || text.text}\n`
        }

        case 'space':
        case 'html':
            return ''

        default:
            return inline([token])
    }
}

/** 一列最窄压到多少，再窄就没法看了，此时退回竖向排布 */
const MIN_COLUMN = 6

/**
 * 表格。
 *
 * 字符网格里没有真正的表格，所以要么画成对齐的网格，要么退化成竖向的
 * key/value 列表。以前只要有一列特别宽就整个退化成竖向，观感很差；
 * 现在会先把各列按比例压窄、单元格内容按列宽折行，压到不能再压才退化。
 */
function renderTable(table: Tokens.Table, width: number): string {
    const cellText = (value: Tokens.TableCell): string => inline(value.tokens).trim()
    const header = table.header.map(cellText)
    const rows = table.rows.map((row) => row.map(cellText))

    const natural = header.map((value, i) =>
        Math.max(visibleWidth(value), ...rows.map((row) => visibleWidth(row[i] ?? ''))),
    )

    const widths = fitWidths(natural, width)
    if (!widths) return renderTableVertical(header, rows)

    const wrapRow = (cells: readonly string[]): string[][] =>
        cells.map((cell, i) => wrapAnsi(cell, widths[i]!))

    const lines: string[] = []
    lines.push(...renderRow(wrapRow(header), widths, (text) => bold(text)))
    lines.push(dim(widths.map((w) => '─'.repeat(w)).join('─┼─')))
    for (const row of rows) lines.push(...renderRow(wrapRow(row), widths, (text) => text))

    return `${lines.join('\n')}\n\n`
}

/** 把自然列宽压到总宽放得下；压不下去（列太多）就返回 undefined */
function fitWidths(natural: readonly number[], width: number): number[] | undefined {
    const widths = [...natural]
    if (width <= 0) return widths

    const separators = (widths.length - 1) * 3
    let total = widths.reduce((sum, w) => sum + w, 0) + separators

    while (total > width) {
        let widest = -1
        for (let i = 0; i < widths.length; i += 1) {
            if (widths[i]! <= MIN_COLUMN) continue
            if (widest === -1 || widths[i]! > widths[widest]!) widest = i
        }
        if (widest === -1) return undefined
        widths[widest] = widths[widest]! - 1
        total -= 1
    }

    return widths
}

/** 一个逻辑行可能因为折行占多个屏幕行，逐行拼出来 */
function renderRow(
    cells: readonly string[][],
    widths: readonly number[],
    paint: (text: string) => string,
): string[] {
    const height = Math.max(1, ...cells.map((cell) => cell.length))
    const out: string[] = []

    for (let line = 0; line < height; line += 1) {
        const parts = cells.map((cell, i) => paint(padEnd(cell[line] ?? '', widths[i]!)))
        out.push(parts.join(` ${dim('│')} `).trimEnd())
    }

    return out
}

/** 压不到目标宽度时的退化形态：第一列当标题，其余当 key/value */
function renderTableVertical(header: readonly string[], rows: readonly string[][]): string {
    const body = rows
        .map((row) => {
            const [first = '', ...rest] = row
            const fields = rest.map((value, i) => `  ${dim(header[i + 1] ?? '')}  ${value}`)
            return [bold(first), ...fields].join('\n')
        })
        .join('\n\n')

    return `${body}\n\n`
}

/**
 * 抽出所有标题，给 pager 的目录跳转用。
 *
 * 只取文字，不带样式；pager 拿到标题后在渲染好的行里找对应位置。
 */
export function headingTitles(source: string): string[] {
    const titles: string[] = []
    for (const token of marked.lexer(source)) {
        if (token.type !== 'heading') continue
        const text = stripAnsi(inline((token as Tokens.Heading).tokens)).trim()
        if (text !== '') titles.push(text)
    }
    return titles
}

/** width 是终端列数，0 表示不限（测试用） */
export function renderMarkdown(source: string, width = 0): string {
    const tokens = marked.lexer(source)
    return (
        tokens
            .map((token) => block(token, width))
            .join('')
            // 段落自带 \n\n，块之间会攒出多余空行
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+$/gm, '')
            .replace(/^\n+/, '')
            .replace(/\n+$/, '')
    )
}
