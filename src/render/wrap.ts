/**
 * 按显示宽度折行，保留 ANSI 样式和 OSC 8 链接。
 *
 * 这是整屏查看（pager）的地基：分页必须按"屏幕行"算，而 markdown 渲染出来的
 * 一个逻辑行可能占两三屏行。直接交给 xterm 自动折是不行的 —— 那样我们就
 * 不知道一行到底占几行了。
 *
 * 两个难点：
 *   1. 不能在转义序列中间切断
 *   2. 在带样式的段落中间换行时，后半段得重新打开样式（否则后半段是素的）
 */

import { visibleWidth } from './width.ts'
import { OSC8_CLOSE, OSC8_OPEN, RESET } from './ansi.ts'

/** 匹配一整条转义序列：CSI（颜色/光标）或 OSC（超链接） */
const ESCAPE = /\x1b\[[0-9;]*m|\x1b\]8;;[^\x1b]*\x1b\\/y

/** 关闭码 → 它关掉哪些开启码 */
const CLOSERS: Record<number, (open: number) => boolean> = {
    22: (open) => open === 1 || open === 2,
    23: (open) => open === 3,
    24: (open) => open === 4,
    27: (open) => open === 7,
    29: (open) => open === 9,
    39: (open) => (open >= 30 && open <= 37) || (open >= 90 && open <= 97) || open === 38,
    49: (open) => (open >= 40 && open <= 47) || open === 48,
}

/** 一条 SGR 序列的第一个参数，`38;5;1` / `38;2;r;g;b` 都算 38 */
function sgrCode(sequence: string): number | undefined {
    const match = /^\x1b\[([0-9;]*)m$/.exec(sequence)
    if (!match) return undefined
    const first = match[1]?.split(';')[0]
    return first === undefined || first === '' ? 0 : Number(first)
}

/** `\x1b]8;;<url>\x1b\\` 是开启，`\x1b]8;;\x1b\\` 是关闭 */
function isHyperlinkOpen(sequence: string): boolean {
    return sequence.length > OSC8_CLOSE.length
}

/** 当前行还开着的样式和链接 */
interface StyleState {
    codes: string[]
    link?: string
}

function pushSequence(state: StyleState, sequence: string): void {
    if (sequence.startsWith(OSC8_OPEN)) {
        state.link = isHyperlinkOpen(sequence) ? sequence : undefined
        return
    }

    const code = sgrCode(sequence)
    if (code === undefined) return

    if (code === 0) {
        state.codes = []
        return
    }

    const closer = CLOSERS[code]
    if (closer) {
        state.codes = state.codes.filter((open) => !closer(sgrCode(open) ?? -1))
        return
    }

    state.codes.push(sequence)
}

function reopen(state: StyleState): string {
    return (state.link ?? '') + state.codes.join('')
}

function closeAll(state: StyleState): string {
    const tail = state.link ? OSC8_CLOSE : ''
    return tail + (state.codes.length > 0 ? RESET : '')
}

/**
 * 把一行（可含 ANSI）折成多行，每行显示宽度不超过 width。
 *
 * 尽量在空格处断行；没有空格（比如中文）就硬切。
 */
export function wrapAnsi(line: string, width: number): string[] {
    if (width <= 0) return [line]
    if (visibleWidth(line) <= width) return [line]

    const out: string[] = []
    const state: StyleState = { codes: [] }
    let current = ''
    let currentWidth = 0
    /** 当前行里最后一个空格的位置，用来优先在词间断开 */
    let spaceAt = -1
    let spaceWidth = 0

    const flush = (hard: boolean): void => {
        let head = current
        let tail = ''

        if (!hard && spaceAt >= 0 && spaceWidth > 0) {
            // 在空格处断：把空格之后的部分挪到下一行
            tail = head.slice(spaceAt + 1)
            head = head.slice(0, spaceAt)
            currentWidth -= spaceWidth
        } else {
            currentWidth = 0
        }

        out.push(head + closeAll(state))
        current = reopen(state) + tail
        if (tail !== '') {
            // tail 是纯文本，宽度要重新算（不含样式序列）
            currentWidth = visibleWidth(tail)
        }
        spaceAt = -1
        spaceWidth = 0
    }

    let index = 0
    while (index < line.length) {
        ESCAPE.lastIndex = index
        const escape = ESCAPE.exec(line)
        if (escape) {
            current += escape[0]
            pushSequence(state, escape[0])
            index += escape[0].length
            continue
        }

        // 按码点取一个字符，避免把代理对拆开
        const char = String.fromCodePoint(line.codePointAt(index) ?? 0)
        const charWidth = visibleWidth(char)

        if (currentWidth + charWidth > width) {
            if (char === ' ') {
                // 行已满且下一个就是空格：直接断行，空格丢掉
                flush(true)
                index += 1
                continue
            }
            // 词还没结束：整个词能挪到下一行时软断（回退到空格），否则硬切
            const tail = spaceAt >= 0 ? currentWidth - spaceWidth : Number.POSITIVE_INFINITY
            const fitsOnNextLine = tail + charWidth <= width
            flush(!fitsOnNextLine)
        }

        current += char
        currentWidth += charWidth
        if (char === ' ') {
            spaceAt = current.length - 1
            spaceWidth = currentWidth
        }
        index += char.length
    }

    out.push(current + closeAll(state))
    return out.filter((chunk, i) => i === out.length - 1 || chunk !== '')
}
