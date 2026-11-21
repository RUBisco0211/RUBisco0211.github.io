import {
    ALT_SCREEN_OFF,
    ALT_SCREEN_ON,
    CLEAR_SCREEN,
    ERASE_LINE,
    inverse,
    moveTo,
} from '@/render/ansi.ts'
import { truncateTo, visibleWidth } from '@/render/width.ts'
import type { Term } from '@/term/terminal.ts'
import { ListCursor } from './list.ts'
import { Scroll } from './scroll.ts'
import { statusBar, type StatusBarOptions } from './status.ts'
import { TextInput } from './text-input.ts'

export interface ScreenOptions {
    readonly onKey: (event: KeyboardEvent) => void
    readonly onWheel?: (deltaY: number, deltaMode: number) => void
    readonly onResize?: (screen: Screen) => void
    /** resize 防抖毫秒，默认 80 */
    readonly resizeDebounce?: number
}

export type FlashPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** 每个位置贴哪边。用表查，不从字面量里 substr。 */
const FLASH_ANCHOR: Record<FlashPosition, { readonly top: boolean; readonly left: boolean }> = {
    'top-left': { top: true, left: true },
    'top-right': { top: true, left: false },
    'bottom-left': { top: false, left: true },
    'bottom-right': { top: false, left: false },
}

export interface FlashOptions {
    /** 提示位置，默认 'top-right' */
    readonly position?: FlashPosition
    /** 持续毫秒，默认 1200 */
    readonly duration?: number
    /** 提示样式，默认反显 */
    readonly paint?: (text: string) => string
    /** 提示消失后重画被盖住的内容；不给就只把光标挪回状态行 */
    readonly restore?: () => void
}

/**
 * 整屏 TUI 的状态容器。
 *
 * 一个组件只跟它打交道：
 * - 生命周期：构造时切 alternate screen、接管键盘、监听 resize；`close()` 一次性还原
 * - 画布：`put` / `clear` / `status` 攒一帧，`flush` 写出去
 * - 状态：`input`（单行输入）、`list`（列表光标）、`scroll`（滚动视口）
 *
 * 绘制循环和模式状态机仍由组件自己持有——pager 有多模式，select 有筛选，
 * 硬套同一个绘制抽象会立刻泄漏。
 */
export class Screen {
    readonly term: Term
    readonly input = new TextInput()
    readonly list: ListCursor
    readonly scroll: Scroll

    private parts: string[] = []
    private readonly releaseKeys: () => void
    private readonly releaseResize: () => void
    private timer: ReturnType<typeof setTimeout> | undefined
    private flashTimer: ReturnType<typeof setTimeout> | undefined
    private closed = false

    constructor(term: Term, options: ScreenOptions) {
        this.term = term
        this.list = new ListCursor({ total: 0, visible: Math.max(1, term.rows - 1) })
        this.scroll = new Scroll({ height: Math.max(1, term.rows - 1) })

        term.write(`${ALT_SCREEN_ON}${CLEAR_SCREEN}`)
        this.releaseKeys = term.captureKeys(options.onKey, options.onWheel)

        const onResize = options.onResize
        this.releaseResize = onResize
            ? term.onResize(() => {
                  clearTimeout(this.timer)
                  this.timer = setTimeout(() => onResize(this), options.resizeDebounce ?? 80)
              })
            : () => {}
    }

    get cols(): number {
        return this.term.cols
    }

    get rows(): number {
        return this.term.rows
    }

    /** 攒一行（0-based）：自动 ERASE_LINE + 截断到 cols */
    put(row: number, text: string): void {
        this.parts.push(`${moveTo(row + 1)}${ERASE_LINE}${truncateTo(text, this.cols)}`)
    }

    /** 清一行 */
    clear(row: number): void {
        this.parts.push(`${moveTo(row + 1)}${ERASE_LINE}`)
    }

    /** 画最后一行状态栏 */
    status(options: Omit<StatusBarOptions, 'cols'>): void {
        this.put(this.rows - 1, statusBar({ ...options, cols: this.cols }))
    }

    /** 裸写（临时提示、动画这类绕开攒帧的） */
    write(text: string): void {
        this.term.write(text)
    }

    /**
     * 在屏幕角落盖一条临时提示（复制结果这种），到点再把被盖住的内容重画回来。
     *
     * 内容直接写进字符网格，会盖住底下的内容；中途任何一次 `flush()` 也会把它冲掉。
     * 写完后把光标放回状态行末尾，不然它停在提示右边缘。
     */
    flash(text: string, options: FlashOptions = {}): void {
        const label = ` ${text} `
        const width = visibleWidth(label)
        if (width >= this.cols) return

        const anchor = FLASH_ANCHOR[options.position ?? 'top-right']
        const row = anchor.top ? 1 : this.rows
        const col = anchor.left ? 1 : this.cols - width + 1
        const paint = options.paint ?? inverse

        this.write(`${moveTo(row, col)}${paint(label)}${moveTo(this.rows, this.cols)}`)

        clearTimeout(this.flashTimer)
        this.flashTimer = setTimeout(() => {
            if (this.closed) return
            options.restore?.()
            this.write(moveTo(this.rows, this.cols))
        }, options.duration ?? 1200)
    }

    /** 把攒的行一次性写出去 */
    flush(): void {
        if (this.parts.length === 0) return
        this.term.write(this.parts.join(''))
        this.parts = []
    }

    /** 归还键盘、摘 resize、退出 alternate screen */
    close(): void {
        this.closed = true
        clearTimeout(this.timer)
        clearTimeout(this.flashTimer)
        this.releaseResize()
        this.releaseKeys()
        this.term.write(ALT_SCREEN_OFF)
    }
}
