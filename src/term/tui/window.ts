/** 让选中项始终留在可视窗口里。pager 的目录模式和 select 共用。 */
export function clampWindow(index: number, offset: number, visible: number): number {
    if (index < offset) return index
    if (index >= offset + visible) return index - visible + 1
    return offset
}
