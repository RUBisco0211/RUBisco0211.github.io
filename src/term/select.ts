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
  readonly items: readonly SelectItem<T>[]
  readonly hint?: string
  /** 初始选中项 */
  readonly initial?: number
  /** 光标移动时回调，用来做实时预览 */
  readonly onHighlight?: (item: SelectItem<T>, index: number) => void
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
  const { items } = options
  if (items.length === 0) return Promise.resolve(undefined)

  const rows = term.rows
  const cols = term.cols
  const visible = Math.max(1, rows - 3)

  let index = Math.min(Math.max(options.initial ?? 0, 0), items.length - 1)
  let offset = 0

  const draw = (): void => {
    offset = clampWindow(index, offset, visible)

    const parts: string[] = []
    const put = (row: number, text: string): void => {
      parts.push(`\x1b[${row + 1};1H\x1b[2K${truncateTo(text, cols)}`)
    }

    put(0, `${bold(options.title)}${options.hint ? `  ${dim(options.hint)}` : ''}`)

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

    put(rows - 1, dim(`${index + 1}/${items.length}　↑↓ 移动　Enter 确认　Esc 取消`))
    term.write(parts.join(''))
  }

  term.write('\x1b[?1049h\x1b[H\x1b[2J')
  draw()
  options.onHighlight?.(items[index]!, index)

  return new Promise((resolve) => {
    const finish = (result: SelectItem<T> | undefined): void => {
      release()
      term.write('\x1b[?1049l')
      resolve(result)
    }

    const move = (delta: number): void => {
      const next = Math.min(Math.max(index + delta, 0), items.length - 1)
      if (next === index) return
      index = next
      draw()
      options.onHighlight?.(items[index]!, index)
    }

    const release = term.captureKeys((event) => {
      switch (event.key) {
        case 'Enter':
          finish(items[index])
          return
        case 'Escape':
        case 'q':
          finish(undefined)
          return
        case 'ArrowUp':
        case 'k':
          move(-1)
          return
        case 'ArrowDown':
        case 'j':
          move(1)
          return
      }
    })
  })
}
