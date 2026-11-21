/**
 * 终端尺寸门槛。
 *
 * 字符网格在窄窗口里排不下：状态栏会溢出、柱状图会折行、表格对不齐。
 * 与其在每个组件里各写一套降级，不如统一挡住——低于这个尺寸就盖一层遮罩，
 * 不让用户继续操作。
 */

/** 少于此列数时整屏内容（状态栏 / 柱状图 / 表格）开始溢出 */
export const MIN_COLS = 48
/** 少于此行数时 pager 的正文视口剩不下几行 */
export const MIN_ROWS = 12

export function tooSmall(cols: number, rows: number): boolean {
    return cols < MIN_COLS || rows < MIN_ROWS
}

/** 遮罩上显示的提示，终端 / DOM 两种遮罩共用一份文案 */
export function sizeHint(): string {
    return `窗口太小 · 至少 ${MIN_COLS}×${MIN_ROWS}`
}
