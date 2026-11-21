import type { Canvas } from './canvas.ts'
import type { TuiSession } from './session.ts'

/**
 * 一个整屏视图。
 *
 * 视图是「演员」：只负责画、响应键、发结束信号。它在栈里的位置、被谁盖住、
 * 何时恢复，全由 `TuiSession` 决定——视图自己不 show 自己、不关会话。
 */
export interface TuiView {
    /** 只画。拿到的是画布，不知道输入和生命周期 */
    draw(canvas: Canvas): void

    /** 交互。切视图、flash、选区都从会话上拿 */
    key?(event: KeyboardEvent, session: TuiSession): void

    wheel?(deltaY: number, deltaMode: number): void

    /**
     * 结束信号。resolve 后由会话决定：弹栈回父视图，或（栈已空时）关闭会话。
     * 视图永远不需要自己知道这是哪种。
     */
    readonly done?: Promise<unknown>

    /** 被盖住 / 被弹走时调用（动画该停、计时器该清） */
    onHide?(): void

    /** 挂上或恢复显示时调用（拿到会话，可以取画布、重启动画） */
    onShow?(session: TuiSession): void
}
