/** 多少像素算一行。鼠标滚轮一格约 100px，正好一行 */
const PIXELS_PER_LINE = 100
/**
 * 小于这个量认为是触控板的连续小 delta（需要累积）；
 * 大于等于它就是鼠标的离散一格（一次结算，不跨事件留小数）。
 */
const NOTCH_MIN = 50

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

/**
 * 滚轮 → 整行。
 *
 * trackpad 一次 delta 只有几像素，必须按像素累积，攒够一行才吐；
 * 鼠标一格约 100px ≈ 1.25 行。滚动器和列表选择共用。
 */
export class WheelLines {
    private pixels = 0
    private readonly pixelsPerLine: number

    constructor(pixelsPerLine = PIXELS_PER_LINE) {
        this.pixelsPerLine = pixelsPerLine
    }

    /** 喂一次滚轮，返回应移动的整行数（0 表示还不足一行） */
    take(deltaY: number, deltaMode = 0): number {
        if (deltaY === 0) return 0

        // 行 / 页模式本身就带单位，直接换算成整行
        if (deltaMode !== 0) return Math.round(wheelLines(deltaY, deltaMode, this.pixelsPerLine))

        // 鼠标一格是离散的大 delta：一次事件结算掉，不跨事件留小数，
        // 否则「一格 100px」和「一行 100px」的误差会攒出「有时走两行」
        if (Math.abs(deltaY) >= NOTCH_MIN) {
            const lines = Math.round(deltaY / this.pixelsPerLine)
            return lines === 0 ? Math.sign(deltaY) : lines
        }

        // 触控板：小步长必须累积，攒够一行才动
        this.pixels += deltaY
        const whole = Math.trunc(this.pixels / this.pixelsPerLine)
        if (whole === 0) return 0

        this.pixels -= whole * this.pixelsPerLine
        return whole
    }

    /** 到边界或视图切换时丢掉余量，免得反向先空转 */
    reset(): void {
        this.pixels = 0
    }
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
    private readonly wheelLines: WheelLines

    constructor(options: ScrollOptions = {}) {
        this.count = options.total ?? 0
        this.view = Math.max(1, options.height ?? 1)
        this.wheelLines = new WheelLines(options.pixelsPerLine ?? PIXELS_PER_LINE)
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
        const lines = this.wheelLines.take(deltaY, deltaMode)
        if (lines === 0) return false
        if (this.scrollBy(lines)) return true
        this.wheelLines.reset()
        return false
    }
}
