/**
 * 单行文本输入状态。
 *
 * 只管「Backspace 删一个 / 可打印字符追加」，不处理光标移动、粘贴、IME。
 * select 的筛选框和 pager 的搜索框共用。
 */
export class TextInput {
    private buffer: string

    constructor(initial = '') {
        this.buffer = initial
    }

    get value(): string {
        return this.buffer
    }

    set(value: string): void {
        this.buffer = value
    }

    clear(): void {
        this.buffer = ''
    }

    /**
     * 处理一个按键。消费了返回 true，调用方据此重绘。
     * 带 Ctrl/Meta/Alt 的组合键不消费，留给调用方当快捷键。
     */
    handle(event: KeyboardEvent): boolean {
        if (event.key === 'Backspace') {
            this.buffer = this.buffer.slice(0, -1)
            return true
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            this.buffer += event.key
            return true
        }
        return false
    }
}
