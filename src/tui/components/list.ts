/** 让选中项始终留在可视窗口里 */
export function clampWindow(index: number, offset: number, visible: number): number {
    if (index < offset) return index
    if (index >= offset + visible) return index - visible + 1
    return offset
}

export interface ListCursorOptions {
    readonly total: number
    readonly visible: number
    readonly initial?: number
}

/**
 * 列表光标：选中索引 + 可视窗口起点。
 *
 * select 和 pager 的目录模式共用。`move` 返回是否真的动了，调用方据此决定重绘。
 */
export class ListCursor {
    private cursor: number
    private start: number
    private count: number
    private view: number

    constructor(options: ListCursorOptions) {
        this.count = options.total
        this.view = Math.max(1, options.visible)
        this.cursor = Math.min(Math.max(options.initial ?? 0, 0), Math.max(0, this.count - 1))
        this.start = 0
    }

    get index(): number {
        return this.cursor
    }

    get offset(): number {
        return this.start
    }

    get visible(): number {
        return this.view
    }

    get total(): number {
        return this.count
    }

    setTotal(total: number): void {
        this.count = total
        this.cursor = Math.min(this.cursor, Math.max(0, total - 1))
        this.start = clampWindow(this.cursor, this.start, this.view)
    }

    setVisible(visible: number): void {
        this.view = Math.max(1, visible)
        this.start = clampWindow(this.cursor, this.start, this.view)
    }

    move(delta: number): boolean {
        if (this.count === 0) return false
        const next = Math.min(Math.max(this.cursor + delta, 0), this.count - 1)
        if (next === this.cursor) return false
        this.cursor = next
        this.start = clampWindow(this.cursor, this.start, this.view)
        return true
    }

    reset(): void {
        this.cursor = 0
        this.start = 0
    }
}
