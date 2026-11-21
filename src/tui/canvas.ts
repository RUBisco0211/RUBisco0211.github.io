import type { TuiDriver } from '@/term/driver.ts'
import { statusBar, type StatusBarOptions } from './components/status.ts'

/**
 * 纯画布：一次 TUI 里所有「往屏幕写」都经过它。
 *
 * 只依赖 TuiDriver，不认识输入、会话、视图。视图的 `draw` 拿到它：
 * 行寻址和转义序列由驱动（Term）负责，画布只表达「第几行放什么」。
 */
export class Canvas {
    private readonly driver: TuiDriver

    constructor(driver: TuiDriver) {
        this.driver = driver
    }

    get cols(): number {
        return this.driver.cols
    }

    get rows(): number {
        return this.driver.rows
    }

    /** 整行重写（0-based），自动擦除旧内容并截断到 cols */
    put(row: number, text: string): void {
        this.driver.drawRow(row, text)
    }

    /** 清掉一行 */
    clear(row: number): void {
        this.driver.drawRow(row, '')
    }

    /** 画最后一行状态栏 */
    status(options: Omit<StatusBarOptions, 'cols'>): void {
        this.put(this.rows - 1, statusBar({ ...options, cols: this.cols }))
    }

    /** 裸写（动画这类绕开行画布的） */
    write(data: string): void {
        this.driver.write(data)
    }
}
