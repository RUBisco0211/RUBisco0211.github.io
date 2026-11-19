import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Readline } from 'xterm-readline'
import type { History } from 'xterm-readline/lib/history.js'
import { SiteHistory } from './history.ts'
import '@xterm/xterm/css/xterm.css'

export interface TermOptions {
  theme: ITheme
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  scrollback?: number
}

/** xterm-readline 没公开但补全要用到的部分 */
interface ReadlineInternals {
  activeRead?: { prompt: string }
  printPrompt(prompt: string, done: (tty: unknown) => void): void
  state: { reanchor(tty: unknown): void }
}

/**
 * xterm 的一层薄封装。
 *
 * 负责：实例化、addon、尺寸自适应、主题、以及给上层一个干净的读写面。
 * 不负责：命令、内容、路由 —— 那些是 shell 的事。
 *
 * 行编辑器由 xterm-readline 提供（回显、光标移动、多行、CJK 宽度、历史）。
 * Tab 补全它没有，所以在宿主元素上捕获 keydown 自己接。
 */
export class Term {
  readonly xterm: Terminal
  readonly readline: Readline

  private readonly host: HTMLElement
  private readonly siteHistory: SiteHistory
  private readonly fitAddon = new FitAddon()
  private readonly observer: ResizeObserver
  /** 上一次列出的内容，避免连按 Tab 时重复堆叠同一份候选 */
  private lastListed = ''
  /** 有 TUI（pager）接管键盘时，Tab 补全要让路 */
  private capturing = false
  private disposed = false

  constructor(host: HTMLElement, opts: TermOptions) {
    this.host = host
    this.xterm = new Terminal({
      theme: opts.theme,
      fontFamily: opts.fontFamily ?? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: opts.fontSize ?? 14,
      lineHeight: 1.1,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: opts.scrollback ?? 5000,
      allowProposedApi: true,
    })

    this.xterm.loadAddon(this.fitAddon)
    this.xterm.loadAddon(new Unicode11Addon())
    this.xterm.loadAddon(new WebLinksAddon())

    this.readline = new Readline()
    // xterm-readline 在构造函数里就用裸 key 'history' 恢复过一次，这里换成
    // 带前缀的实现并重新恢复，顺带把旧数据迁移过来
    this.siteHistory = new SiteHistory(50)
    const withHistory = this.readline as unknown as { history: History }
    withHistory.history = this.siteHistory
    this.siteHistory.restoreFromLocalStorage()
    this.xterm.loadAddon(this.readline)

    this.xterm.open(host)

    // DOM 渲染器把方块字符交给字体画，字形比单元格窄一点就露背景，
    // 像素画（neofetch 的 art、表格边框）会出现一道道竖缝。
    // WebGL 渲染器配 customGlyphs 会把 █▄▀ 画成精确矩形，缝隙消失。
    //
    // 它有 100KB 左右，不该占首屏，所以等首屏画完再异步装上。
    // 加载失败或环境不支持时留在 DOM 渲染器上，只是有缝，不影响使用。
    void import('@xterm/addon-webgl')
      .then(({ WebglAddon }) => {
        if (this.disposed) return
        const webgl = new WebglAddon()
        webgl.onContextLoss(() => webgl.dispose())
        this.xterm.loadAddon(webgl)
      })
      .catch(() => {
        // 没有 WebGL 就算了
      })

    try {
      this.xterm.unicode.activeVersion = '11'
    } catch {
      // unicode11 addon 不可用时退回默认宽度处理
    }

    this.fitAddon.fit()
    this.observer = new ResizeObserver(() => this.fitAddon.fit())
    this.observer.observe(host)

    // 字体是异步加载的：首帧用回退字体算出的行高会偏小，字体到位后
    // 单元格变高，屏幕就超出容器，最后一行被裁掉。所以字体就绪后再 fit 一次。
    void document.fonts?.ready.then(() => this.fitAddon.fit())
    document.fonts?.addEventListener?.('loadingdone', () => this.fitAddon.fit())
  }

  /**
   * 显示提示符并等一行输入。历史由 SiteHistory 落到 localStorage。
   *
   * initial 非空时会把内容回填到输入行（光标在末尾），用户可以继续编辑。
   * readline 的 state 是在提示符写完之后才建的，所以排一个空的 write 回调
   * 来等它 —— xterm 的 write 是排队执行的，我们的回调必然在提示符之后。
   */
  read(prompt: string, initial = ''): Promise<string> {
    const pending = this.readline.read(prompt)
    if (initial === '') return pending

    this.xterm.write('', () => {
      try {
        this.readline.updateLine(initial)
      } catch {
        // readline 状态已经没了（比如被 Ctrl-C 取消），忽略
      }
    })

    return pending
  }

  /** 写一行（自动补换行），走 readline 的通道以保持它的光标记账正确。 */
  println(text = ''): void {
    this.readline.println(text)
  }

  print(text: string): void {
    this.readline.print(text)
  }

  /** 裸写，不经过 readline 的记账。只在确定不会和输入行打架时用。 */
  write(data: string): void {
    this.xterm.write(data)
  }

  /** 清屏。调用时机必须在两次 read() 之间。 */
  clear(): void {
    this.xterm.clear()
  }

  setTheme(theme: ITheme): void {
    this.xterm.options.theme = theme
  }

  /** 终端当前列数，给需要按宽度排版的命令用 */
  /** 历史命令，最新的在前 */
  historyEntries(): string[] {
    return [...this.siteHistory.entries]
  }

  /** 手动追加一条（绕开 read() 直接执行命令时用） */
  appendHistory(text: string): void {
    this.siteHistory.append(text)
  }

  clearHistory(): void {
    this.siteHistory.entries = []
    this.siteHistory.saveToLocalStorage()
  }

  /** 终端尺寸变化（FitAddon 已经处理过 fit，这里只是转发） */
  onResize(handler: () => void): () => void {
    const subscription = this.xterm.onResize(() => handler())
    return () => subscription.dispose()
  }

  get cols(): number {
    return this.xterm.cols
  }

  get rows(): number {
    return this.xterm.rows
  }

  focus(): void {
    this.xterm.focus()
  }

  /**
   * 拦截 Tab。
   *
   * 用捕获阶段的 DOM 监听，而不是 xterm 的 attachCustomKeyEventHandler ——
   * readline 自己也注册了那个（每个终端只能有一个），覆盖掉会打断它的按键处理。
   */
  onTab(handler: () => void): void {
    this.host.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Tab' || this.capturing) return
        event.preventDefault()
        event.stopPropagation()
        handler()
      },
      true,
    )
  }

  /**
   * 接管键盘，交给 TUI 自己处理。
   *
   * 捕获阶段拦下来，xterm 就不会把按键变成 onData，readline 也就收不到。
   * 返回的函数用来归还键盘。
   */
  captureKeys(
    handler: (event: KeyboardEvent) => void,
    onWheel?: (deltaY: number, deltaMode: number) => void,
  ): () => void {
    this.capturing = true

    const onKey = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      handler(event)
    }

    const onWheelEvent = (event: WheelEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      onWheel?.(event.deltaY, event.deltaMode)
    }

    this.host.addEventListener('keydown', onKey, true)
    // 不开 xterm 的鼠标追踪（那会劫持文本选中），直接拦 DOM 的 wheel
    if (onWheel)
      this.host.addEventListener('wheel', onWheelEvent, { capture: true, passive: false })

    return () => {
      this.capturing = false
      this.host.removeEventListener('keydown', onKey, true)
      this.host.removeEventListener('wheel', onWheelEvent, true)
      this.focus()
    }
  }

  /**
   * 把候选列表打印在输入行下方，然后重印提示符和当前输入。
   *
   * readline 没有公开的"打印并重绘"接口，所以借它的 printPrompt + reanchor：
   * 换行 → 打印候选 → 在新位置重新锚定已有的输入缓冲。
   */
  showCompletions(items: readonly string[]): void {
    const readline = this.readline as unknown as ReadlineInternals
    const active = readline.activeRead
    if (!active) return

    const signature = `${this.readline.getLine()}\u0000${items.join('\u0000')}`
    if (signature === this.lastListed) return
    this.lastListed = signature

    // 光标此刻在输入行末尾：先换到下一行，候选打在输入行下方，
    // 再让 readline 在候选之后重印提示符和当前输入（bash 就是这个行为）
    this.readline.println('')
    for (const item of items) this.readline.println(item)
    readline.printPrompt(active.prompt, (tty) => readline.state.reanchor(tty))
  }

  dispose(): void {
    this.disposed = true
    this.observer.disconnect()
    this.xterm.dispose()
  }
}
