/**
 * 把可视窗口挪到刚好能让 `index` 露出来的位置。
 *
 * 不满足时才滚动：往上越界让选中项落到第一行，往下越界让它落到最后一行；
 * 选中项本来就在窗口里就保持不动。整体行数装得下时窗口永远是 0，不做滚动。
 */
export function clampWindow(index: number, offset: number, visible: number, total: number): number {
    const limit = Math.max(0, total - visible)
    let start = Math.min(Math.max(offset, 0), limit)
    if (index < start) start = index
    else if (index >= start + visible) start = index - visible + 1
    return Math.min(Math.max(start, 0), limit)
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
        this.count = Math.max(0, options.total)
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

    /** 总数和视口一起变：只夹一次，避免占位视口先把窗口钉到光标上 */
    setBounds(total: number, visible: number): void {
        this.count = Math.max(0, total)
        this.view = Math.max(1, visible)
        this.sync()
    }

    setTotal(total: number): void {
        this.count = Math.max(0, total)
        this.sync()
    }

    setVisible(visible: number): void {
        this.view = Math.max(1, visible)
        this.sync()
    }

    move(delta: number): boolean {
        if (this.count === 0) return false
        const next = Math.min(Math.max(this.cursor + delta, 0), this.count - 1)
        if (next === this.cursor) return false
        this.cursor = next
        this.sync()
        return true
    }

    reset(): void {
        this.cursor = 0
        this.start = 0
    }

    /** 把游标和窗口一起夹回有效范围 */
    private sync(): void {
        this.cursor = Math.min(Math.max(this.cursor, 0), Math.max(0, this.count - 1))
        this.start = clampWindow(this.cursor, this.start, this.view, this.count)
    }
}
