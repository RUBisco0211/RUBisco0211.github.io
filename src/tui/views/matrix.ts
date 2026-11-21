import type { TuiDriver } from '@/term/driver.ts'
import { CURSOR_HIDE, CURSOR_SHOW, brightGreen, dim, green, moveTo } from '@/render/ansi.ts'
import type { Canvas } from '@/tui/canvas.ts'
import { TuiSession } from '@/tui/session.ts'
import type { TuiView } from '@/tui/view.ts'

/** 帧间隔（毫秒），越小雨越快 */
const FRAME_MS = 70

/** 半角片假名 + 数字，Matrix 里的经典字符集 */
const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789'

interface Column {
    /** 头部所在行（可以是负数，表示还没进屏幕） */
    head: number
    /** 每帧前进几格 */
    step: number
    /** 尾巴长度 */
    length: number
    /** 尾巴上的字符，trail[0] 是头部 */
    trail: string[]
}

interface Cell {
    row: number
    char: string
    /** 0 = 头部最亮，越大越暗 */
    level: 0 | 1 | 2
}

const pick = (): string => CHARS[Math.floor(Math.random() * CHARS.length)] ?? '0'

function makeColumn(rows: number, startAbove = true): Column {
    const length = 4 + Math.floor(Math.random() * Math.max(4, Math.floor(rows / 2)))
    const head = startAbove ? -Math.floor(Math.random() * rows) : 0
    return {
        head,
        step: Math.random() < 0.3 ? 2 : 1,
        length,
        trail: Array.from({ length }, pick),
    }
}

/** 把一条尾巴映射成屏幕上的格子，越界的不返回 */
function columnCells(column: Column, rows: number): Cell[] {
    const cells: Cell[] = []
    const top = Math.floor(column.head)

    for (let i = 0; i < column.trail.length; i += 1) {
        const row = top - i
        if (row < 0 || row >= rows) continue
        const level: Cell['level'] = i === 0 ? 0 : i < column.length / 3 ? 1 : 2
        cells.push({ row, char: column.trail[i] ?? ' ', level })
    }

    return cells
}

/** 推进一帧：头往下走，尾巴换一个新字符 */
function advance(column: Column): Column {
    const head = column.head + column.step
    return {
        ...column,
        head,
        trail: [pick(), ...column.trail.slice(0, column.length - 1)],
    }
}

/** 头部和整条尾巴都出屏了，该重新开始 */
function isDone(column: Column, rows: number): boolean {
    return Math.floor(column.head) - column.length >= rows
}

const style = (level: Cell['level'], text: string): string => {
    if (level === 0) return brightGreen(text)
    if (level === 1) return green(text)
    return dim(green(text))
}

/**
 * 数字雨：逐帧写整屏的动画视图。
 *
 * 和普通视图不同，它不靠 `draw` 出帧——动画循环自己用 `canvas.write` 写。
 * `onShow` 启动、`onHide` 停止；q / Esc / Ctrl-C 结束自己。
 */
export class MatrixView implements TuiView {
    readonly done: Promise<void>

    private readonly finish: () => void
    private canvas: Canvas | undefined
    private columns: Column[] = []
    private rows = 1
    private timer: ReturnType<typeof setTimeout> | undefined

    constructor() {
        let finish!: () => void
        this.done = new Promise<void>((resolve) => {
            finish = resolve
        })
        this.finish = finish
    }

    onShow(session: TuiSession): void {
        const canvas = session.canvas
        this.canvas = canvas
        this.rows = canvas.rows
        const width = Math.max(1, Math.floor(canvas.cols / 2)) // 每列占两格，看起来更稀
        this.columns = Array.from({ length: width }, () => makeColumn(this.rows))
        canvas.write(CURSOR_HIDE)
        this.frame()
    }

    onHide(): void {
        clearTimeout(this.timer)
        this.canvas?.write(CURSOR_SHOW)
    }

    /** 帧由动画循环写，不走逐行绘制 */
    draw(): void {}

    key(event: KeyboardEvent): void {
        const quit =
            event.key === 'q' || event.key === 'Escape' || (event.ctrlKey && event.key === 'c')
        if (quit) this.finish()
    }

    private frame = (): void => {
        if (!this.canvas) return
        const parts: string[] = []
        const { rows } = this

        this.columns = this.columns.map((column, index) => {
            const next = advance(column)

            // 尾巴末端的下一格要擦掉，否则会留一条不动的痕
            const clearRow = Math.floor(next.head) - next.length
            if (clearRow >= 0 && clearRow < rows) {
                parts.push(`${moveTo(clearRow + 1, index * 2 + 1)} `)
            }

            for (const cell of columnCells(next, rows)) {
                parts.push(`${moveTo(cell.row + 1, index * 2 + 1)}${style(cell.level, cell.char)}`)
            }

            // 整个头都掉出屏幕了，清掉整列再从头开始
            if (isDone(next, rows)) {
                for (let row = 0; row < rows; row += 1) {
                    parts.push(`${moveTo(row + 1, index * 2 + 1)} `)
                }
                return makeColumn(rows)
            }

            return next
        })

        this.canvas.write(parts.join(''))
        this.timer = setTimeout(this.frame, FRAME_MS)
    }
}

/** 开一次会话，挂上数字雨，按 q 退出。 */
export async function runMatrix(driver: TuiDriver): Promise<void> {
    const session = new TuiSession(driver)
    const view = new MatrixView()
    session.open(view)
    return view.done.finally(() => session.close())
}
