import {
    ALT_SCREEN_OFF,
    ALT_SCREEN_ON,
    CLEAR_SCREEN,
    ERASE_LINE,
    bold,
    cyan,
    dim,
    moveTo,
} from '../render/ansi.ts'
import { lookupKey, resolveKeys, type Keymap } from './keys.ts'
import type { Term } from './terminal.ts'
import { truncateTo } from '../render/width.ts'

export interface SelectItem<T> {
    readonly value: T
    readonly label: string
    readonly detail?: string
}

export type SelectAction = 'up' | 'down' | 'confirm' | 'cancel'

/** 默认键位只在组件内部用，调用方只传覆盖项 */
const DEFAULT_KEYS: Keymap<SelectAction> = {
    up: ['ArrowUp', 'k'],
    down: ['ArrowDown', 'j'],
    confirm: ['Enter'],
    cancel: ['Escape', 'q'],
}

export interface SelectLabels {
    /** 列表为空时底部的占位文本 */
    readonly empty: string
    /** 底部操作提示，文案由调用方按自己的键位写 */
    readonly footer: string
}

export interface SelectOptions<T> {
    readonly title: string
    readonly labels: SelectLabels
    /** 允许输入关键字筛选（打开后 Esc 才是唯一取消键，q 变成普通字符） */
    readonly filterable?: boolean
    readonly items: readonly SelectItem<T>[]
    readonly hint?: string
    /** 初始选中项 */
    readonly initial?: number
    /** 光标移动时回调，用来做实时预览 */
    readonly onHighlight?: (item: SelectItem<T>, index: number) => void
    /** 键位覆盖，按动作替换默认值 */
    readonly keys?: Partial<Keymap<SelectAction>>
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
 * 用 alternate screen 铺满一屏，退出时原屏幕还原
 * 键盘由 Term.captureKeys 处理
 *
 * 返回选中的项
 * 按 Esc / q 取消时返回 undefined
 *
 */
export function select<T>(term: Term, options: SelectOptions<T>): Promise<T | undefined> {
    if (options.items.length === 0) return Promise.resolve(undefined)

    const rows = term.rows
    const cols = term.cols
    const visible = Math.max(1, rows - 3)
    const keymap = resolveKeys(DEFAULT_KEYS, options.keys)

    let query = ''
    let items = options.items
    let index = Math.min(Math.max(options.initial ?? 0, 0), items.length - 1)
    let offset = 0

    const draw = (): void => {
        offset = clampWindow(index, offset, visible)

        const parts: string[] = []
        const put = (row: number, text: string): void => {
            parts.push(`${moveTo(row + 1)}${ERASE_LINE}${truncateTo(text, cols)}`)
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

        const position = items.length === 0 ? options.labels.empty : `${index + 1}/${items.length}`
        put(rows - 1, dim(`${position}　${options.labels.footer}`))
        term.write(parts.join(''))
    }

    term.write(`${ALT_SCREEN_ON}${CLEAR_SCREEN}`)
    draw()
    const initialItem = items[index]
    if (initialItem) options.onHighlight?.(initialItem, index)

    return new Promise((resolve) => {
        const finish = (result: SelectItem<T> | undefined): void => {
            release()
            term.write(ALT_SCREEN_OFF)
            resolve(result?.value)
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
            // 可筛选时，可打印字符先给筛选框（j/k/q 也不例外）
            if (options.filterable) {
                if (event.key === 'Backspace') {
                    refilter(query.slice(0, -1))
                    return
                }
                if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    refilter(query + event.key)
                    return
                }
            }

            switch (lookupKey(keymap, event)) {
                case 'confirm':
                    finish(items[index])
                    return
                case 'cancel':
                    finish(undefined)
                    return
                case 'up':
                    move(-1)
                    return
                case 'down':
                    move(1)
                    return
            }
        })
    })
}
