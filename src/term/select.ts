import { bold, cyan, dim } from './ansi.ts'
import type { Term } from './terminal.ts'
import { truncateTo } from './width.ts'

export interface SelectItem<T> {
    readonly value: T
    readonly label: string
    /** 右侧的补充说明，压暗显示 */
    readonly detail?: string
}

export interface SelectOptions<T> {
    readonly title: string
    /** 允许输入关键字筛选（打开后 Esc 才是唯一取消键，q 变成普通字符） */
    readonly filterable?: boolean
    readonly items: readonly SelectItem<T>[]
    readonly hint?: string
    /** 初始选中项 */
    readonly initial?: number
    /** 光标移动时回调，用来做实时预览 */
    readonly onHighlight?: (item: SelectItem<T>, index: number) => void
}

/** 按 label + detail 做子串筛选，忽略大小写 */
export function filterItems<T>(
    items: readonly SelectItem<T>[],
    query: string,
): readonly SelectItem<T>[] {
    const needle = query.trim().toLowerCase()
    if (needle === '') return items
    return items.filter((item) =>
        `${item.label} ${item.detail ?? ''}`.toLowerCase().includes(needle),
    )
}

/** 让选中项始终留在可视窗口里 */
export function clampWindow(index: number, offset: number, visible: number): number {
    if (index < offset) return index
    if (index >= offset + visible) return index - visible + 1
    return offset
}

/**
 * 整屏单选列表。
 *
 * 用 alternate screen 铺满一屏，退出时原屏幕还原。键盘走 Term.captureKeys，
 * 所以 readline 收不到这些按键。
 *
 * 返回选中的项；按 Esc / q 取消时返回 undefined。
 */
export function select<T>(
    term: Term,
    options: SelectOptions<T>,
): Promise<SelectItem<T> | undefined> {
    if (options.items.length === 0) return Promise.resolve(undefined)

    const rows = term.rows
    const cols = term.cols
    const visible = Math.max(1, rows - 3)

    let query = ''
    let items = options.items
    let index = Math.min(Math.max(options.initial ?? 0, 0), items.length - 1)
    let offset = 0

    const draw = (): void => {
        offset = clampWindow(index, offset, visible)

        const parts: string[] = []
        const put = (row: number, text: string): void => {
            parts.push(`\x1b[${row + 1};1H\x1b[2K${truncateTo(text, cols)}`)
        }

        const heading = query === '' ? options.title : `${options.title} · ${query}`
        const hint = options.hint ? dim(options.hint) : ''
        put(0, `${bold(heading)}${hint ? `  ${hint}` : ''}`)

        for (let line = 0; line < visible; line += 1) {
            const item = items[offset + line]
            if (!item) {
                put(line + 1, '')
                continue
            }
            const active = offset + line === index
            const marker = active ? cyan('>') : ' '
            const label = active ? cyan(item.label) : item.label
            const detail = item.detail ? `  ${dim(item.detail)}` : ''
            put(line + 1, ` ${marker} ${label}${detail}`)
        }

        const position = items.length === 0 ? '无匹配' : `${index + 1}/${items.length}`
        put(rows - 1, dim(`${position}　↑↓ 移动　Enter 确认　Esc 取消`))
        term.write(parts.join(''))
    }

    term.write('\x1b[?1049h\x1b[H\x1b[2J')
    draw()
    const initialItem = items[index]
    if (initialItem) options.onHighlight?.(initialItem, index)

    return new Promise((resolve) => {
        const finish = (result: SelectItem<T> | undefined): void => {
            release()
            term.write('\x1b[?1049l')
            resolve(result)
        }

        const move = (delta: number): void => {
            if (items.length === 0) return
            const next = Math.min(Math.max(index + delta, 0), items.length - 1)
            if (next === index) return
            index = next
            draw()
            const current = items[index]
            if (current) options.onHighlight?.(current, index)
        }

        /** 改筛选词后重算列表，光标回到第一项 */
        const refilter = (next: string): void => {
            query = next
            items = filterItems(options.items, query)
            index = 0
            offset = 0
            draw()
            if (items[0]) options.onHighlight?.(items[0], 0)
        }

        const release = term.captureKeys((event) => {
            switch (event.key) {
                case 'Enter':
                    finish(items[index])
                    return
                case 'Escape':
                    finish(undefined)
                    return
                case 'ArrowUp':
                    move(-1)
                    return
                case 'ArrowDown':
                    move(1)
                    return
            }

            // 可筛选时不占用字母键做移动，q 也不能当取消
            if (options.filterable) {
                if (event.key === 'Backspace') {
                    refilter(query.slice(0, -1))
                    return
                }
                if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    refilter(query + event.key)
                }
                return
            }

            if (event.key === 'q') finish(undefined)
            else if (event.key === 'k') move(-1)
            else if (event.key === 'j') move(1)
        })
    })
}
