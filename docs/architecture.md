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

## TUI 组件：pager 和 select

两者都用 `term/tui/screen.ts` 的 `Screen` 对象。一个组件只跟它打交道：

- **生命周期**：构造时切 alternate screen、`Term.captureKeys()` 接管键盘、监听 resize；`close()` 一次性归还
- **画布**：`put(row, text)` / `clear(row)` / `status({ left, right, hints })` 攒一帧，`flush()` 写出去
- **状态**：`input`（单行输入）、`list`（列表光标）、`scroll`（滚动视口）

```ts
const screen = new Screen(term, { onKey, onWheel, onResize })
screen.list.setTotal(items.length)
screen.put(0, title)
screen.status({ left: title, right: '10%', hints })
screen.flush()
screen.close()
```

绘制循环和模式状态机仍由组件自己持有——pager 有多模式，select 有筛选，硬套同一个绘制抽象会泄漏。

| 文件                            | 职责                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `term/tui/screen.ts`            | `Screen`：生命周期 + 画布 + `input`/`list`/`scroll`                                |
| `term/tui/list.ts`              | `ListCursor`：选中索引 + 可视窗口                                                  |
| `term/tui/scroll.ts`            | `Scroll`：offset / 翻页 / 滚轮累积                                                 |
| `term/tui/text-input.ts`        | `TextInput`：Backspace + 可打印字符                                                |
| `term/tui/status.ts`            | `statusBar()`：整行反显，放不下从头部丢提示                                        |
| `term/tui/components/pager/`    | 整屏阅读器：`index.ts` 交互循环，`logic.ts` 纯逻辑（标题定位、进度文本、选区清理） |
| `term/tui/components/select.ts` | 通用单选列表：`theme`、`history`、`tags`、`search` 用                              |

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
