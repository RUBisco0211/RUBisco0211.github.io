import { inverse, moveTo } from '@/render/ansi.ts'
import { visibleWidth } from '@/render/width.ts'
import type { TuiDriver } from '@/term/driver.ts'
import { Canvas } from './canvas.ts'
import type { TuiView } from './view.ts'

export type FlashPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface FlashOptions {
    readonly position?: FlashPosition
    readonly duration?: number
    readonly paint?: (text: string) => string
}

/** 每个位置贴哪边。用表查，不从字面量里 substr。 */
const FLASH_ANCHOR: Record<FlashPosition, { readonly top: boolean; readonly left: boolean }> = {
    'top-left': { top: true, left: true },
    'top-right': { top: true, left: false },
    'bottom-left': { top: false, left: true },
    'bottom-right': { top: false, left: false },
}

/**
 * 一次 TUI 会话。
 *
 * 时间范围：从构造（抢输入 + 进 alt screen）到 `close()`（还输入 + 出 alt screen）。
 * 区间内是一个视图栈：任意数量的视图可以进栈/弹栈，栈空即会话结束。
 *
 * 它是唯一调度者——视图只发信号（`done` / `key`），不自己切自己。
 */
export class TuiSession {
    readonly canvas: Canvas

    private readonly driver: TuiDriver
    private readonly stack: TuiView[] = []
    private readonly releaseInput: () => void
    private readonly releaseResize: () => void
    private resizeTimer: ReturnType<typeof setTimeout> | undefined
    private flashTimer: ReturnType<typeof setTimeout> | undefined
    private closed = false

    constructor(driver: TuiDriver) {
        this.driver = driver
        this.canvas = new Canvas(driver)

        // 先抢输入（失败直接抛，不留下 alt screen），再切屏、订阅 resize
        this.releaseInput = driver.captureInput({
            onKey: (event) => {
                this.current()?.key?.(event, this)
                this.redraw()
            },
            onWheel: (deltaY, deltaMode) => {
                this.current()?.wheel?.(deltaY, deltaMode)
                this.redraw()
            },
        })
        driver.enterAltScreen()
        this.releaseResize = driver.onResize(() => {
            clearTimeout(this.resizeTimer)
            this.resizeTimer = setTimeout(() => this.redraw(), 80)
        })
    }

    /** 当前视图（栈顶）。栈空时返回 undefined。 */
    current(): TuiView | undefined {
        return this.stack.at(-1)
    }

    /**
     * 挂一个视图。
     *
     * 旧视图收到 `onHide`，新视图收到 `onShow`；它的 `done` resolve 后会话自动弹栈。
     */
    open(view: TuiView): void {
        if (this.closed) return
        this.current()?.onHide?.()
        this.stack.push(view)

        view.done?.then(
            () => this.settle(view),
            () => this.settle(view),
        )

        view.onShow?.(this)
        this.redraw()
    }

    /** 立即重绘当前视图 */
    redraw(): void {
        if (this.closed) return
        // 重绘后 buffer 内容变了，旧选区会漂到新内容上，所以每次重画都清掉
        if (this.driver.hasSelection()) this.driver.clearSelection()
        this.current()?.draw(this.canvas)
    }

    /** 选区 / 剪贴板（交互侧，视图从会话语义上拿） */
    hasSelection(): boolean {
        return this.driver.hasSelection()
    }

    getSelection(): string {
        return this.driver.getSelection()
    }

    clearSelection(): void {
        this.driver.clearSelection()
    }

    copy(text: string): Promise<boolean> {
        return this.driver.copy(text)
    }

    /** 在屏幕角落盖一条临时提示，到点重绘当前视图 */
    flash(text: string, options: FlashOptions = {}): void {
        const label = ` ${text} `
        const width = visibleWidth(label)
        if (width >= this.canvas.cols) return

        const anchor = FLASH_ANCHOR[options.position ?? 'top-right']
        const row = anchor.top ? 1 : this.canvas.rows
        const col = anchor.left ? 1 : this.canvas.cols - width + 1
        const paint = options.paint ?? inverse

        this.driver.write(
            `${moveTo(row, col)}${paint(label)}${moveTo(this.canvas.rows, this.canvas.cols)}`,
        )

        clearTimeout(this.flashTimer)
        this.flashTimer = setTimeout(() => {
            this.redraw()
            this.driver.write(moveTo(this.canvas.rows, this.canvas.cols))
        }, options.duration ?? 1200)
    }

    /** 一次性归还：清定时器、摘 resize、还输入、退 alt screen。幂等。 */
    close(): void {
        if (this.closed) return
        this.closed = true
        clearTimeout(this.resizeTimer)
        clearTimeout(this.flashTimer)
        this.releaseResize()
        this.releaseInput()
        this.driver.exitAltScreen()
    }

    /** 栈顶视图结束：弹栈，栈空则关闭会话；否则恢复父视图 */
    private settle(finished: TuiView): void {
        const index = this.stack.lastIndexOf(finished)
        if (index < 0 || this.closed) return

        const wasTop = index === this.stack.length - 1
        this.stack.splice(index, 1)
        finished.onHide?.()

        if (this.stack.length === 0) {
            this.close()
            return
        }
        if (wasTop) {
            this.current()?.onShow?.(this)
            this.redraw()
        }
    }
}
