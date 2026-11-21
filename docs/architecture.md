# 技术选型与子系统设计

本文记录「为什么这么选」和「子系统怎么设计」。改动前必读的硬约束在仓库根目录的
[AGENTS.md](../AGENTS.md)「核心契约」里，这里属于补充背景。

## 技术栈与理由

| 选型                      | 理由                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **xterm.js**              | 要的是字符网格 + ANSI + scrollback。不用它就得自己实现渲染循环                                  |
| **xterm-readline**        | 行编辑器（回显、光标、多行折行、CJK 宽度）不要自己写。它缺 Tab 补全，我们自己补                 |
| **marked**                | 只要 token 树，不要 HTML。markdown-it 是 HTML 渲染器，产出的 `<p>` 还得再剥一遍                 |
| **@speed-highlight/core** | 内置终端 ANSI 输出，零依赖，1.5KB 核心 + 1KB/语言。highlight.js 只出 HTML，cli-highlight 已停更 |
| **Vite**                  | dev server + 插件（内容编译）+ 打包                                                             |
| **无框架**                | 状态是「REPL 循环 + 只读文件系统」，不是派生 UI。React 在这里只增加协调开销                     |
| **原生 CSS 变量**         | 主题切换只是换几个 CSS 变量，页面里没有别的 DOM 层要同步                                        |
| **GitHub Pages Actions**  | 用户页挂在根路径，`base` 不用动；push 到 main 自动部署                                          |

## TUI：TuiDriver / TuiSession / Canvas / TuiView

分层是单向的：`term`（xterm 封装）→ `tui`（整屏 UI 子系统）→ `shell`（命令拼装）。

```ts
// term/driver.ts：tui 唯一认识的终端面
interface TuiDriver {
    cols, rows, onResize
    enterAltScreen(), exitAltScreen()
    drawRow(row, text)     // 定位 + 擦除 + 截断 + 写入
    write(data)            // 裸写逃生舱（动画）
    captureInput({ onKey, onWheel? })   // 键盘 + 滚轮共用一个排他锁
    hasSelection(), getSelection(), clearSelection(), copy(text)
}
```

`Term` 实现 `TuiDriver`；REPL 用的 `read` / `println` / 补全 / 历史 / 主题不在接口里，tui 拿不到。

一次全屏交互 = 一个 `TuiSession`，时间范围从构造（抢输入 + 进 alt screen）到 `close()`：

```ts
const session = new TuiSession(term) // TuiDriver
const view = new SelectView(options) // 或 new PagerView(input) / new MatrixView()
session.open(view) // 压栈 + 绘制
await view.done // 视图结束自己；栈空时 session 自动 close()
```

- **`TuiSession`**：会话宿主 + 视图栈，唯一调度者。持输入锁、alt screen、resize 防抖；
  提供 `canvas`、`open()`、`flash()`、`close()`、选区/剪贴板转发。视图结束只 resolve `done`，
  弹栈还是关会话由栈深决定——**视图不自己 show 自己**
- **`Canvas`**：纯画布（`put` / `clear` / `status` / `write`），不认识输入和会话
- **`TuiView`**：`{ draw(canvas), key?(event, session), wheel?, done?, onShow?, onHide? }`。
  `onHide` 在「被盖住 / 被弹走」时调用（停动画），`onShow` 在恢复时调用
- **`SelectView`**：光标 + 筛选 + 滚轮选择 + 确认/取消，`onConfirm` 在弹栈前回调父视图
- **`PagerView`**：通用阅读器（正文 + 滚动 + 搜索 + 复制），**不认识目录/标题**。
  它只暴露 `renderedLines()` / `jumpTo(line)` 和 `bindings` 扩展点；目录这类功能由命令层组合，
  见 `commands/utils/outline.ts`

命令只看到薄壳 `select(term, ...)` / `runPager(term, ...)`（内部 `new TuiSession` + `open` + 等 `done`），
文档排版在 `commands/utils/pager-input.ts` 的 `toPagerInput`：这是 cat / search / tags 共用的
命令层辅助件，只有命令层同时认识 content 和 tui。目录功能同理放在 `commands/utils/outline.ts`：
`toPagerInput` 通过 `bindings` 把 `t` 挂到 `openOutline()`，pager 不知道目录存在。
命令不接触 alt screen / 输入锁 / resize。
`matrix` 是 `views/matrix.ts` 的 `MatrixView`：动画循环用 `canvas.write` 逐帧写，`onShow` 启动、
`onHide` 停止，命令只剩一行 `runMatrix(ctx.term)`。

视图嵌套是**视图栈**，不是串行会话：pager 上再开目录选择器时，选择器压在 pager 上，选完自动弹回；
而命令层的 tags → 选文章 → pager 是三个**串行会话**（前一个关闭才开下一个）。

| 文件                            | 职责                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| `term/driver.ts`                | `TuiDriver`：暴露给 tui 的窄接口（`Term` 实现）                             |
| `tui/session.ts`                | `TuiSession`：会话生命周期 + 视图栈 + flash                                 |
| `tui/canvas.ts`                 | `Canvas`：纯画布                                                            |
| `tui/view.ts`                   | `TuiView` 接口                                                              |
| `tui/components/list.ts`        | `ListCursor`：选中索引 + 可视窗口                                           |
| `tui/components/scroll.ts`      | `Scroll`：offset / 翻页 / 滚轮累积                                          |
| `tui/components/text-input.ts`  | `TextInput`：Backspace + 可打印字符                                         |
| `tui/components/status.ts`      | `statusBar()`：整行反显，放不下从头部丢提示                                 |
| `tui/views/select.ts`           | `SelectView` + `select(driver, ...)` 薄壳                                   |
| `tui/views/pager.ts`            | `PagerView`（通用阅读器：不含目录概念）+ `runPager(driver, PagerInput)`     |
| `tui/views/matrix.ts`           | `MatrixView`：数字雨动画 + `runMatrix(driver)`                              |
| `commands/utils/pager-input.ts` | `toPagerInput(doc, text, opts)`：命令层共享的 Document → PagerInput 适配器  |
| `commands/utils/outline.ts`     | 目录功能：`locateTitles` + `openOutline`（通过 pager 的 `bindings` 挂上去） |

命令里 `await` 它们，所以占用期间 shell 不会去调 `term.read()`——两者天然互斥，shell 不用改。

## 命令行着色

用 `xterm-readline` 官方的 `Highlighter` 接口（`Term.setLineHighlighter`），它每次重绘会把
`highlightPrompt(prompt) + highlight(line, pos)` 拼起来，光标位置按**未着色**的原始行算。

所以 `highlightLine()` 只能往字符之间插样式，**绝不能增删字符**（测试里有断言：去色后必须和原行逐字符一致）。
认得的命令青、别名品红、不认识的红、选项黄、引号内容绿；参数一律默认色。

## 列对齐统一走 `render/table.ts`

ls / help / cat / stats / Tab 补全都是「逐行、若干单元格、按列宽补齐」这一类。
`formatTable(rows, options)` 负责测列宽、逐列补齐、按 gap 拼接、`trimEnd`；
`formatRow()` 用显式列宽（固定列或多块共享宽度时用），`rowWidth()` 给画横线用。
单元格可以带 ANSI / OSC 8，宽度一律按 `visibleWidth` 算；**不做截断**，需要截的先 `truncateTo`。

柱状行（label + 柱 + 右对齐数值）抽在 `render/barRows.ts`，stats 用它排版。
（tags 的标签总览和文章列表已改成整屏 select，不再走表格。）

neofetch 的信息区是三张小表（个人 / 终端 / 站点），每张表各自用自己的列宽对齐，
分隔线统一取整块最大宽度；art 与信息区的左右并排仍归 `layout()`。

例外：markdown 表格（单元格折行、定宽压缩）保留自己的实现，没有塞进 table 抽象。
