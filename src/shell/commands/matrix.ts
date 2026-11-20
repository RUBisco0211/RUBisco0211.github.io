import {
    ALT_SCREEN_OFF,
    ALT_SCREEN_ON,
    CLEAR_SCREEN,
    CURSOR_HIDE,
    CURSOR_SHOW,
    brightGreen,
    dim,
    green,
    moveTo,
} from '../../render/ansi.ts'
import type { Command } from '../types.ts'

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

const matrix: Command = {
    name: 'matrix',
    description: '数字雨',
    run(ctx) {
        const term = ctx.term
        const cols = term.cols
        const rows = term.rows
        const width = Math.max(1, Math.floor(cols / 2)) // 每列占两格，看起来更稀

        let columns = Array.from({ length: width }, () => makeColumn(rows))
        let timer: ReturnType<typeof setTimeout> | undefined

        term.write(`${ALT_SCREEN_ON}${CURSOR_HIDE}${CLEAR_SCREEN}`)

        return new Promise<void>((resolve) => {
            const finish = (): void => {
                clearTimeout(timer)
                release()
                term.write(`${CURSOR_SHOW}${ALT_SCREEN_OFF}`)
                resolve()
            }

            const frame = (): void => {
                const parts: string[] = []

                columns = columns.map((column, index) => {
                    const next = advance(column)

                    // 尾巴末端的下一格要擦掉，否则会留一条不动的痕
                    const clearRow = Math.floor(next.head) - next.length
                    if (clearRow >= 0 && clearRow < rows) {
                        parts.push(`${moveTo(clearRow + 1, index * 2 + 1)} `)
                    }

                    for (const cell of columnCells(next, rows)) {
                        parts.push(
                            `${moveTo(cell.row + 1, index * 2 + 1)}${style(cell.level, cell.char)}`,
                        )
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

                term.write(parts.join(''))
                timer = setTimeout(frame, FRAME_MS)
            }

            const release = term.captureKeys((event) => {
                const quit =
                    event.key === 'q' ||
                    event.key === 'Escape' ||
                    (event.ctrlKey && event.key === 'c')
                if (quit) finish()
            })

            frame()
        })
    },
}

export default matrix
