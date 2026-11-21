/**
 * pager 的纯逻辑：选区清理、标题定位、进度文本。
 *
 * 滚动/状态栏/输入/光标分别在 `scroll.ts`、`status.ts`、`text-input.ts`、`list.ts`。
 */

import { stripAnsi } from '../../../render/width.ts'

/**
 * 把 xterm 的选区文本整理成适合粘贴的样子。
 *
 * buffer 的每一行是空格填充的，选到行尾会带一串空白；选区结束在空行时
 * 末尾还会剩几个换行。段落之间的空行要保留，所以只去行尾空白和末尾换行。
 */
export function cleanSelection(text: string): string {
    return text
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n+$/, '')
}

/** 底部状态栏右边的进度文本：`10%  ·  1-10/100` */
export function progress(offset: number, total: number, height: number): string {
    const percent = Math.min(
        100,
        total <= height ? 100 : Math.round(((offset + height) / total) * 100),
    )
    const position = `${offset + 1}-${Math.min(offset + height, total)}/${total}`
    return `${percent}%  ·  ${position}`
}

/**
 * 把标题映射到渲染后的行号。
 *
 * 渲染器不返回"第几行是标题"，所以这里按文字匹配：同一批标题顺序向后找，
 * 这样重复的标题也能各自对上（不会都指到第一个）。
 */
export function locateTitles(lines: readonly string[], titles: readonly string[]): number[] {
    const found: number[] = []
    let cursor = 0

    for (const title of titles) {
        const needle = title.trim().toLowerCase()
        let hit = -1

        if (needle !== '') {
            for (let i = cursor; i < lines.length; i += 1) {
                if (
                    stripAnsi(lines[i] ?? '')
                        .trim()
                        .toLowerCase()
                        .startsWith(needle)
                ) {
                    hit = i
                    break
                }
            }
        }

        found.push(hit)
        if (hit >= 0) cursor = hit + 1
    }

    return found
}
