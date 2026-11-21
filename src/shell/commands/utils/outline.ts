import { stripAnsi } from '@/render/width.ts'
import type { TuiSession } from '@/tui/session.ts'
import type { PagerView } from '@/tui/views/pager.ts'
import { SelectView } from '@/tui/views/select.ts'

/** 目录选择器的操作提示 */
const HINTS = '↑↓ 选择  ·  Enter 跳转  ·  Esc 取消'

/**
 * 把标题映射到渲染后的行号。
 *
 * 渲染器不返回"第几行是标题"，所以这里按文字匹配：同一批标题顺序向后找，
 * 这样重复的标题也能各自对上（不会都指到第一个）。
 *
 * 这是目录功能自己的逻辑，所以放在命令层，pager 不参与。
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

/**
 * 打开目录选择器，确认后跳到对应行。
 *
 * 这是命令层对 pager 的组合：pager 只提供 `bindings` / `renderedLines()` / `jumpTo()`，
 * 并不知道「目录」是什么。
 */
export function openOutline(
    view: PagerView,
    session: TuiSession,
    options: { readonly title: string; readonly titles: readonly string[] },
): void {
    if (options.titles.length === 0) return

    const targets = locateTitles(view.renderedLines(), options.titles)
    const picker = new SelectView({
        title: `${options.title} · 目录`,
        labels: { empty: '', footer: HINTS },
        items: options.titles.map((title, index) => ({ value: index, label: title })),
        onConfirm: (index) => {
            const target = targets[index]
            if (target !== undefined && target >= 0) view.jumpTo(target)
        },
    })
    session.open(picker)
}
