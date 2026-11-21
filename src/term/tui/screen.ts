import { ALT_SCREEN_OFF, ALT_SCREEN_ON, CLEAR_SCREEN } from '../../render/ansi.ts'
import type { Term } from '../terminal.ts'

export interface FullscreenOptions {
    readonly onKey: (event: KeyboardEvent) => void
    readonly onWheel?: (deltaY: number, deltaMode: number) => void
    /** 尺寸变化后的重排回调；不给就不监听 resize */
    readonly onResize?: () => void
    /** resize 防抖毫秒，默认 80 */
    readonly resizeDebounce?: number
}

export interface Fullscreen {
    /** 归还键盘、摘 resize、退出 alternate screen。幂等调用一次即可。 */
    close(): void
}

/**
 * 整屏 TUI 的公共生命周期：切 alternate screen、接管键盘、监听尺寸、退出时清理。
 *
 * 只负责「进/出和清理」，绘制和状态机留给调用方——pager 有多模式，select 有筛选，
 * 硬套同一个绘制抽象会立刻泄漏。
 */
export function enterFullscreen(term: Term, options: FullscreenOptions): Fullscreen {
    term.write(`${ALT_SCREEN_ON}${CLEAR_SCREEN}`)

    const releaseKeys = term.captureKeys(options.onKey, options.onWheel)

    const onResize = options.onResize
    let timer: ReturnType<typeof setTimeout> | undefined
    const releaseResize = onResize
        ? term.onResize(() => {
              clearTimeout(timer)
              timer = setTimeout(onResize, options.resizeDebounce ?? 80)
          })
        : () => {}

    return {
        close() {
            clearTimeout(timer)
            releaseResize()
            releaseKeys()
            term.write(ALT_SCREEN_OFF)
        },
    }
}
