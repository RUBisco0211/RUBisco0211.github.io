import type { KeyHandler } from './keys.ts'

/** 滚轮回调：deltaY 原始像素/行/页，deltaMode 0=像素 1=行 2=页 */
export type WheelHandler = (deltaY: number, deltaMode: number) => void

export interface InputHandlers {
    /** 必填：TUI 会话必须能收到键盘 */
    readonly onKey: KeyHandler
    /** 可选：不需要滚动的视图可以不接 */
    readonly onWheel?: WheelHandler
}

/**
 * tui 层唯一认识的终端面。
 *
 * 这是 Term 的「驱动面」——只包含整屏 TUI 真正需要的东西：
 * 尺寸、alt screen、整行输出、输入接管、选区/剪贴板。
 * REPL 用的 read / println / 补全 / 历史 / 主题不在其中，tui 拿不到。
 */
export interface TuiDriver {
    // —— 屏幕状态 ——
    readonly cols: number
    readonly rows: number
    /** 终端尺寸变化（防抖由上层决定） */
    onResize(handler: () => void): () => void

    /** 进 alternate screen 并清屏 */
    enterAltScreen(): void
    /** 退 alternate screen */
    exitAltScreen(): void

    // —— 画布 ——
    /** 整行重写：定位 + 擦除 + 截断到 cols + 写入，一步到位 */
    drawRow(row: number, text: string): void
    /** 裸写，绕开行画布（逐帧动画用） */
    write(data: string): void

    // —— 输入 ——
    /**
     * 接管输入：键盘 + 滚轮共用一个排他锁。
     * 已接管时抛错；返回的函数一次性归还两者。
     */
    captureInput(handlers: InputHandlers): () => void

    // —— 选区 / 剪贴板 ——
    hasSelection(): boolean
    getSelection(): string
    clearSelection(): void
    /** 写入系统剪贴板；不可用或权限被拒时返回 false */
    copy(text: string): Promise<boolean>
}
