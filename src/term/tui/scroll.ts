/** 多少像素算一行。鼠标滚轮一格约 100px，所以一格 ≈ 1.25 行 */
const PIXELS_PER_LINE = 80

/** 把 offset 夹在 [0, total - height]。内容比一屏还短时固定在顶部。 */
export function clampOffset(offset: number, total: number, height: number): number {
    const max = Math.max(0, total - height)
    return Math.min(Math.max(offset, 0), max)
}

/** 滚轮 delta 换算成行数（可以是小数）。deltaMode: 0 = 像素，1 = 行，2 = 页。 */
function wheelLines(deltaY: number, deltaMode: number, pixelsPerLine: number): number {
    if (deltaY === 0) return 0
    if (deltaMode === 1) return deltaY
    if (deltaMode === 2) return deltaY * 10
    return deltaY / pixelsPerLine
}

export interface ScrollOptions {
    readonly total?: number
    readonly height?: number
    readonly pixelsPerLine?: number
}

/**
 * 可滚动视口：当前 offset + 内容总行数 + 视口高度。
 *
 * 所有移动方法返回「是否真的滚动了」，调用方据此决定要不要重绘。
 * 滚轮按像素累积，攒够一行才滚；滚到头时丢掉余量，免得反向先空转。
 */
export class Scroll {
    private position = 0
    private count: number
    private view: number
    private readonly pixelsPerLine: number
    private pixels = 0

    constructor(options: ScrollOptions = {}) {
        this.count = options.total ?? 0
        this.view = Math.max(1, options.height ?? 1)
        this.pixelsPerLine = options.pixelsPerLine ?? PIXELS_PER_LINE
    }

    get offset(): number {
        return this.position
    }

    get total(): number {
        return this.count
    }

    get height(): number {
        return this.view
    }

    setTotal(total: number): void {
        this.count = total
        this.position = clampOffset(this.position, total, this.view)
    }

    setHeight(height: number): void {
        this.view = Math.max(1, height)
        this.position = clampOffset(this.position, this.count, this.view)
    }

    scrollTo(next: number): boolean {
        const clamped = clampOffset(next, this.count, this.view)
        if (clamped === this.position) return false
        this.position = clamped
        return true
    }

    scrollBy(delta: number): boolean {
        return this.scrollTo(this.position + delta)
    }

    pageDown(): boolean {
        return this.scrollBy(this.view)
    }

    pageUp(): boolean {
        return this.scrollBy(-this.view)
    }

    halfDown(): boolean {
        return this.scrollBy(Math.floor(this.view / 2))
    }

    halfUp(): boolean {
        return this.scrollBy(-Math.floor(this.view / 2))
    }

    top(): boolean {
        return this.scrollTo(0)
    }

    bottom(): boolean {
        return this.scrollTo(this.count)
    }

    /** 滚轮：返回是否真的滚动了。滚到头时丢掉攒着的余量。 */
    wheel(deltaY: number, deltaMode = 0): boolean {
        this.pixels +=
            deltaMode === 0
                ? deltaY
                : wheelLines(deltaY, deltaMode, this.pixelsPerLine) * this.pixelsPerLine

        const whole = Math.trunc(this.pixels / this.pixelsPerLine)
        if (whole === 0) return false

        this.pixels -= whole * this.pixelsPerLine
        if (this.scrollBy(whole)) return true
        this.pixels = 0
        return false
    }
}
