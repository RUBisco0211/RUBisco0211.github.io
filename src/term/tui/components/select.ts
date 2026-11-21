import { bold, cyan, dim } from '../../../render/ansi.ts'
import { lookupKey, resolveKeys, type Keymap } from '../../keys.ts'
import type { Term } from '../../terminal.ts'
import { Screen } from '../screen.ts'

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

/**
 * 整屏单选列表。
 *
 * 用 alternate screen 铺满一屏，退出时原屏幕还原。
 * 生命周期、画布、输入、列表光标统一由 `Screen` 持有。
 *
 * 返回选中的项；按 Esc / q 取消时返回 undefined。
 */
export function select<T>(term: Term, options: SelectOptions<T>): Promise<T | undefined> {
    if (options.items.length === 0) return Promise.resolve(undefined)

    const keymap = resolveKeys(DEFAULT_KEYS, options.keys)
    let items = options.items
    let query = ''

    return new Promise((resolve) => {
        let screen: Screen | undefined

        const finish = (result: SelectItem<T> | undefined): void => {
            screen?.close()
            resolve(result?.value)
        }

        const draw = (): void => {
            if (!screen) return
            const list = screen.list
            list.setTotal(items.length)
            list.setVisible(Math.max(1, screen.rows - 3))

            const heading = query === '' ? options.title : `${options.title} · ${query}`
            const hint = options.hint ? dim(options.hint) : ''
            screen.put(0, `${bold(heading)}${hint ? `  ${hint}` : ''}`)

            for (let line = 0; line < list.visible; line += 1) {
                const item = items[list.offset + line]
                if (!item) {
                    screen.clear(line + 1)
                    continue
                }
                const active = list.offset + line === list.index
                const marker = active ? cyan('>') : ' '
                const label = active ? cyan(item.label) : item.label
                const detail = item.detail ? `  ${dim(item.detail)}` : ''
                screen.put(line + 1, ` ${marker} ${label}${detail}`)
            }

            const position =
                items.length === 0 ? options.labels.empty : `${list.index + 1}/${items.length}`
            screen.put(screen.rows - 1, dim(`${position}　${options.labels.footer}`))
            screen.flush()
        }

        const move = (delta: number): void => {
            if (!screen || !screen.list.move(delta)) return
            draw()
            const current = items[screen.list.index]
            if (current) options.onHighlight?.(current, screen.list.index)
        }

        /** 改筛选词后重算列表，光标回到第一项 */
        const refilter = (next: string): void => {
            query = next
            items = filterItems(options.items, query)
            screen?.list.reset()
            draw()
            const first = items[0]
            if (first) options.onHighlight?.(first, 0)
        }

        screen = new Screen(term, {
            onKey: (event) => {
                // 可筛选时，可打印字符先给筛选框（j/k/q 也不例外）
                if (options.filterable && screen!.input.handle(event)) {
                    refilter(screen!.input.value)
                    return
                }

                switch (lookupKey(keymap, event)) {
                    case 'confirm':
                        finish(items[screen!.list.index])
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
            },
            onResize: () => draw(),
        })

        draw()
        const initialItem = items[screen.list.index]
        if (initialItem) options.onHighlight?.(initialItem, screen.list.index)
    })
}
