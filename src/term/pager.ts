import { inverse } from './ansi.ts'
import type { Term } from './terminal.ts'
import { padEnd, visibleWidth } from './width.ts'
import { wrapAnsi } from './wrap.ts'

export interface PagerInput {
  readonly title: string
  /**
   * 给定列宽产出未折行的内容（可含 ANSI）。
   * 折行由 pager 自己做，所以视口变宽变窄时只要重新调一次这个函数。
   */
  readonly render: (cols: number) => readonly string[]
}

const ALT_SCREEN_ON = '\x1b[?1049h'
const ALT_SCREEN_OFF = '\x1b[?1049l'

/** 多少像素算一行。鼠标滚轮一格约 100px，所以一格 ≈ 1.25 行 */
const PIXELS_PER_LINE = 80

/**
 * 滚轮 delta 换算成行数（可以是小数）。
 * deltaMode: 0 = 像素（触控板/平滑滚动），1 = 行，2 = 页。
 */
export function wheelLines(deltaY: number, deltaMode = 0, pixelsPerLine = PIXELS_PER_LINE): number {
  if (deltaY === 0) return 0
  if (deltaMode === 1) return deltaY
  if (deltaMode === 2) return deltaY * 10
  return deltaY / pixelsPerLine
}

/**
 * 把小数行数累积成整数行。
 *
 * 触控板一次手势会发几十个 deltaY 很小的事件，逐个"至少滚一行"会滚飞。
 * 这里攒够一整行才动一次，滚动距离就只跟总像素有关。
 */
export interface WheelAccumulator {
  /** 返回攒够的整数行数，不足一行返回 0 */
  next(deltaY: number, deltaMode?: number): number
  /** 丢掉攒着的小数（滚到头时用，免得反向先空转） */
  reset(): void
}

export function createWheelAccumulator(pixelsPerLine = PIXELS_PER_LINE): WheelAccumulator {
  // 按像素累加而不是按行累加：0.1 加十次不等于 1.0，攒够一行会失败
  let pixels = 0
  return {
    next(deltaY, deltaMode = 0) {
      pixels += deltaMode === 0 ? deltaY : wheelLines(deltaY, deltaMode) * pixelsPerLine
      const whole = Math.trunc(pixels / pixelsPerLine)
      pixels -= whole * pixelsPerLine
      return whole
    },
    reset() {
      pixels = 0
    },
  }
}

export function clampOffset(offset: number, total: number, height: number): number {
  const max = Math.max(0, total - height)
  return Math.min(Math.max(offset, 0), max)
}

/** 底部状态栏：左边标题，右边进度和提示，整行反显 */
export function pagerStatus(
  title: string,
  offset: number,
  total: number,
  height: number,
  cols: number,
): string {
  const percent = total <= height ? 100 : Math.round(((offset + height) / total) * 100)
  const right = `${Math.min(percent, 100)}%  ·  ${offset + 1}-${Math.min(offset + height, total)}/${total}  ·  q 退出`
  const gap = 2
  const room = Math.max(0, cols - visibleWidth(right) - gap)
  const left = visibleWidth(title) > room ? truncate(title, room) : title
  const line = padEnd(`${left}${' '.repeat(gap)}`, cols - visibleWidth(right)) + right
  return inverse(padEnd(line, cols))
}

/** 按显示宽度截断，末尾补省略号 */
function truncate(text: string, width: number): string {
  if (width <= 1) return ''
  let out = ''
  let used = 0
  for (const char of text) {
    const w = visibleWidth(char)
    if (used + w > width - 1) break
    out += char
    used += w
  }
  return `${out}…`
}

/**
 * 整屏查看器：切到 alternate screen，自己画每一屏。
 *
 * 不用 DOM overlay，内容直接写进 xterm。退出时 alt screen 还原，
 * 之前的 scrollback 完好无损。
 *
 * 视口变化时会按新宽度重新渲染并重画（alt buffer 不 reflow，必须整屏重来）。
 */
export function runPager(term: Term, input: PagerInput): Promise<void> {
  let cols = term.cols
  let rows = term.rows
  let height = Math.max(1, rows - 1)
  let lines: string[] = []
  let offset = 0

  /** 重新渲染并折行，按比例保住原来的阅读位置 */
  const rebuild = (): void => {
    const previousMax = Math.max(0, lines.length - height)
    const ratio = previousMax > 0 ? offset / previousMax : 0

    lines = input.render(cols).flatMap((line) => wrapAnsi(line, cols))
    offset = clampOffset(
      Math.round(ratio * Math.max(0, lines.length - height)),
      lines.length,
      height,
    )
  }

  const draw = (): void => {
    const total = lines.length
    const parts: string[] = []
    for (let row = 0; row < height; row += 1) {
      const line = lines[offset + row] ?? ''
      parts.push(`\x1b[${row + 1};1H\x1b[2K${line}`)
    }
    parts.push(`\x1b[${rows};1H\x1b[2K${pagerStatus(input.title, offset, total, height, cols)}`)
    term.write(parts.join(''))
  }

  /** 返回是否真的滚动了（滚到头时返回 false） */
  const scrollTo = (next: number): boolean => {
    const clamped = clampOffset(next, lines.length, height)
    if (clamped === offset) return false
    offset = clamped
    draw()
    return true
  }

  rebuild()

  term.write(`${ALT_SCREEN_ON}\x1b[H\x1b[2J`)
  draw()

  // 视口变了就重排。xterm 的 alt buffer 不会 reflow，所以必须整屏重画
  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const releaseResize = term.onResize(() => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      cols = term.cols
      rows = term.rows
      height = Math.max(1, rows - 1)
      rebuild()
      draw()
    }, 80)
  })

  return new Promise<void>((resolve) => {
    const wheel = createWheelAccumulator()
    const release = term.captureKeys(
      (event) => {
        switch (event.key) {
          case 'q':
          case 'Escape':
            clearTimeout(resizeTimer)
            releaseResize()
            release()
            term.write(ALT_SCREEN_OFF)
            resolve()
            return
          case 'j':
          case 'ArrowDown':
            scrollTo(offset + 1)
            return
          case 'k':
          case 'ArrowUp':
            scrollTo(offset - 1)
            return
          case ' ':
          case 'f':
          case 'PageDown':
            scrollTo(offset + height)
            return
          case 'b':
          case 'PageUp':
            scrollTo(offset - height)
            return
          case 'd':
            scrollTo(offset + Math.floor(height / 2))
            return
          case 'u':
            scrollTo(offset - Math.floor(height / 2))
            return
          case 'g':
          case 'Home':
            scrollTo(0)
            return
          case 'G':
          case 'End':
            scrollTo(lines.length)
            return
        }
      },
      (deltaY, deltaMode) => {
        const step = wheel.next(deltaY, deltaMode)
        if (step === 0) return
        // 滚到头了就把攒着的小数丢掉，免得反向时先空转
        if (!scrollTo(offset + step)) wheel.reset()
      },
    )
  })
}
