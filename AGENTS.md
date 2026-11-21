# AGENTS.md

终端风格的纯静态个人站点。没有导航栏、没有卡片列表，访客通过命令浏览内容。

这份文档记录**已经定下来的架构决策**。改动前先读，尤其是「核心契约」和「容易踩的坑」两节。

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

## 目录

```
content/              内容源文件，路径即身份（slug）
  blog/<slug>/index.md
  projects/<slug>/index.md
public/               静态资源
src/
  main.ts             装配 + REPL 循环
  config.ts           站点配置：user/host/字体/主题/alias
  storage.ts          localStorage 唯一入口（统一前缀）
  render/             ANSI 原语、显示宽度、折行、语法着色、markdown→ANSI、列对齐
  term/               xterm 封装、pager/select 整屏组件、命令历史
    pager/             index.ts 交互循环 + logic.ts 纯逻辑
  shell/              tokenize / alias / registry / fs / path / complete / error
    commands/         一条命令一个文件 + 手动在 index.ts 注册
                      （reader.ts 这类命令支撑件也放这里，但不进命令表）
  content/            内容树视图、字数格式化、搜索
  theme/              themes/<名字>.ts（每套含 light/dark 两个变体）+ 聚合 + store
plugins/site-content.ts   content/ → virtual:site-tree
scripts/
  build-content.ts   内容编译器（被 dev 插件和 copy-content 共用）
  copy-content.ts    构建后把 .md 拷进 dist/content/
tests/                node --test，和 src 分开存放
```

## 核心契约

### 1. 内容管线

```
content/**.md ──[编译]──┬──▶ virtual:site-tree    元数据内联进 bundle
                        └──▶ dist/content/<path>  正文原样拷贝，运行时 fetch
```

- **元数据**（title/date/tags/chars/kind/meta）走虚拟模块，首屏就要用
- **正文**按 `doc.path` fetch 原始 `.md`，运行时用 `stripFrontmatter()` 去掉开头的 `---` 块
- **不存在第二份内容**。dev 下由 Vite 插件中间件读磁盘，build 后由 `copy-content.ts` 原样拷
- 只有 `content/` 一份真相源。**不要**在构建期生成改写过内容的中间产物

### 2. 命令契约

```ts
interface Command {
  name: string
  description: string
  usage?: string
  complete?(ctx, argv, current): Completion[]
  run(ctx, args): void | Promise<void>
}

interface Ctx {
  term
  theme
  config
  fs
  content
  registry
  cwd: string // getter，永远反映 shell 当前目录
  chdir(target): string | null // 成功 null，失败返回错误消息
}
```

- 命令**只依赖 `Ctx`**，不 import xterm、不 import 具体 store
- 输出一律走 `ctx.term.println()`。`ctx.term.write()` 是裸写，不经过 readline 记账，只在确定不和输入行打架时用
- 参数不足用 `printUsage(command)`，不要硬编码 `用法：…`（会和 `usage` 字段漂移）
- 错误：命令 `throw` 一个 `ShellError`（或 `fail(...)`），由 `shell.run()` 捕获后交给
  `term.printError()` 统一染红；可选提示用第二参数（如可选值列表）。意外异常不吞，继续抛给 `main.ts` 兜底。
  错误怎么渲染是终端层的事（`Term.printError`），shell 只给消息和提示。

### 3. 命令注册是手动的

`src/shell/commands/index.ts` 显式 import 每条命令并拼成 `commands` 数组。
新增命令 = 新建 `commands/<name>.ts` + 在 `index.ts` 里加一行 import 和一个数组项。

不用 `import.meta.glob` 自动收集：那是 Vite 专属 API，`node --test` 里 import
这个入口会直接报错；显式列表还能让 tsc 立刻发现漏接。

### 4. alias 是单层纯 token 替换

```ts
aliases: {
  posts: 'ls blog'
}
```

- 按 token 拆，不是字符串拼接，所以引号可用
- **只展开一层**，目标本身是别名也不会继续展开
- 不支持 `$1` 占位符——一旦支持就是在发明脚本语言
- 配置在 `src/config.ts`，会出现在 `help` 底部和 Tab 补全里

### 5. localStorage 统一前缀

所有 key 必须经过 `src/storage.ts`，前缀 `tty.blog:`。

**坑**：`xterm-readline` 内部把历史写进裸 key `"history"`。我们用 `SiteHistory` 继承它的 `History`，只覆盖两个存储方法，并把旧数据迁移过来。

### 6. 路径与虚拟文件系统

- slug 就是路径：`blog/从nvm迁移到fnm` → `/blog/从nvm迁移到fnm`
- 目录结构由 slug 推导（`buildFs`），内容想嵌套不用改代码
- 内部一律用绝对路径；显示给用户才用 `displayPath()` 转成 `~/blog`
- 命令接受相对路径、`~`、`..`，以及带 `.md` 后缀的写法

### 7. TUI 组件：pager 和 select

两个都走同一套模式：**alternate screen**（`\x1b[?1049h` / `l`）+ `Term.captureKeys()` 全量接管键盘 +
逐行 `\x1b[{row};1H\x1b[2K` 重绘 + `onResize` 重排（alt buffer 不 reflow，尺寸变了必须整屏重来）。

- `term/pager/` 整屏阅读器：`index.ts` 是交互循环（搜索 `/` 后 `n`/`N`、目录跳转 `t`、滚轮、翻页），
  `logic.ts` 是纯逻辑（滚动换算、标题定位、状态栏、选区清理），不碰 `Term`，直接在 node 里测
- `term/select.ts` 通用单选列表：`theme` 和 `history` 用，支持 `filterable` 的输入筛选

命令里 `await` 它们，所以占用期间 shell 不会去调 `term.read()`——两者天然互斥，shell 不用改。

### 7.1 窄终端直接遮罩

字符网格在窄窗口里排不下（状态栏溢出、柱状图折行、表格对不齐）。所以不做逐组件降级，
而是统一门槛 `term/size.ts`：低于 `MIN_COLS`/`MIN_ROWS` 时 `main.ts` 盖上 `#size-mask`
并 `Term.enableInput(false)`，尺寸回来自动恢复。`pagerStatus`/`barRows` 只保证 ≥ 门槛时不溢出。

`pagerStatus()` 的操作提示按**重要性从低到高**排列，放不下时从头部丢，`q 退出` 留到最后。

### 8. 命令行着色

用 `xterm-readline` 官方的 `Highlighter` 接口（`Term.setLineHighlighter`），它每次重绘会把
`highlightPrompt(prompt) + highlight(line, pos)` 拼起来，光标位置按**未着色**的原始行算。

所以 `highlightLine()` 只能往字符之间插样式，**绝不能增删字符**（测试里有断言：去色后必须和原行逐字符一致）。
认得的命令青、别名品红、不认识的红、选项黄、引号内容绿；参数一律默认色。

### 9. 列对齐统一走 `render/table.ts`

ls / help / cat / stats / Tab 补全都是「逐行、若干单元格、按列宽补齐」这一类。
`formatTable(rows, options)` 负责测列宽、逐列补齐、按 gap 拼接、`trimEnd`；
`formatRow()` 用显式列宽（固定列或多块共享宽度时用），`rowWidth()` 给画横线用。
单元格可以带 ANSI / OSC 8，宽度一律按 `visibleWidth` 算；**不做截断**，需要截的先 `truncateTo`。

柱状行（label + 柱 + 右对齐数值）抽在 `render/barRows.ts`，stats 用它排版。
（tags 的标签总览和文章列表已改成整屏 select，不再走表格。）

neofetch 的信息区是三张小表（个人 / 终端 / 站点），每张表各自用自己的列宽对齐，
分隔线统一取整块最大宽度；art 与信息区的左右并排仍归 `layout()`。

例外：markdown 表格（单元格折行、定宽压缩）保留自己的实现，没有塞进 table 抽象。

## 开发

```bash
npm run dev           # vite，改 content/ 会整页 reload
npm test              # node --test，直接跑 TS（Node 原生类型剥离）
npm run typecheck     # tsc --noEmit
npm run build         # tsc + vite build + copy-content
npm run format        # prettier
```

测试用 `node --test` 而非 vitest/tsx：Node 26 原生支持类型剥离，零依赖。
因此**所有相对 import 必须带 `.ts` 扩展名**（tsconfig 开了 `allowImportingTsExtensions`）。

## 部署

线上：<https://rubisco0211.github.io/>，仓库 `RUBisco0211/RUBisco0211.github.io`（GitHub Pages **用户页**）。

```bash
git push            # 推到 main 就自动部署
```

`.github/workflows/deploy.yml`：`npm ci → test → build → upload-pages-artifact → deploy-pages`。
Pages 的 `build_type` 必须是 `workflow`（不是 `legacy`，那是 Jekyll 分支构建）：

```bash
gh api -X PUT repos/RUBisco0211/RUBisco0211.github.io/pages -f build_type=workflow
```

**`base` 路径**：用户页是根路径，`vite.config.ts` 保持默认 `/`。
如果改成**项目页**（`<user>.github.io/<repo>`），必须设 `base: '/<repo>/'` —— 正文和静态资源都靠
`import.meta.env.BASE_URL` 拼地址，`scripts/copy-content.ts` 写的 `dist/content/` 也在同一个前缀下。

## 容易踩的坑

1. **readline 的私有 API**
   `Term.showCompletions()` 用的是 `printPrompt` + `state.reanchor`（没有公开的「打印并重绘」接口）；
   `Term.read(prompt, initial)` 靠"排一个空 write 再 updateLine"来等 readline 建好 state。
   `tests/term/readline.test.mjs` 里有一份同样的调用序列——它是**副本**，改 `terminal.ts` 时必须手动同步，否则测试全绿但行为已坏（已经发生过一次）。

2. **FitAddon 读的是父元素的 computed `height`**
   它只扣掉 `.xterm` 自己的 padding，**不管父元素的 padding**。所以终端必须放在无内边距的 `#term` 里，留白由外层 `#app` 负责。否则会多算出行数，最后一行被裁掉。

3. **字体是异步的**
   首帧用回退字体算出的行高偏小，真字体到位后单元格变高，屏幕会超出容器。所以 `Term` 在 `document.fonts.ready` 和 `loadingdone` 时都要重新 `fit()`。

4. **prettier 必须跑**
   `terminal.ts` 曾被编辑器改成双引号 + 分号，导致脚本替换静默失败、改动没生效。
   `.prettierrc` 已定死：无分号、单引号、printWidth 100。`content/` 不在格式化范围内（手写内容）。

5. **CJK 对齐要用 `visibleWidth()`**
   按 `text.length` 算会把中文和 ANSI 转义序列一起算错。对齐用 `padEnd()`（在 `src/render/width.ts`）。

6. **`clear` 的时机**
   `xterm.clear()` 会让 readline 的 `promptMarker` 失效，只能在两次 `read()` 之间调用。

7. **回车后命令行不带颜色**
   readline 提交前会调 `State.refreshUnhighlighted()` 把这行重绘成无样式。试过覆盖它让颜色保留，
   但那是改库的内部行为，权衡后撤掉了（`tests/term/readline.test.mjs` 里那条用例记录着默认行为）。

8. **定时器要清干净**
   `matrix` 和 pager 的 resize 防抖都用 `setTimeout`。退出路径必须 `clearTimeout` + 摘掉
   `captureKeys`/`onResize` 的监听，否则退出后还在往终端写东西。用裸 `setTimeout` 而不是
   `window.setTimeout`——测试在 node 里跑，`window` 不存在。

## 明确不做的事

- **管道 / 重定向 / 退出码**：没有进程模型，不做（用 `search` 代替 `cat | grep`）
- **构建期生成正文副本**：全站只保留 `content/` 一份内容
- **自己写 tokenizer / 行编辑器**：有现成库就用现成的
- **SEO 预渲染**：暂时不做。真要做，成本是「每篇生成静态 HTML + sitemap」，`content/` 里的 `.md` 已经是完整真相源
- **DOM overlay 阅读器**：`cat` 走 ANSI 整屏 pager。之前做过一版 DOM overlay，删掉了——两套渲染管线会漂移
- **移动端适配**：字符网格在小屏上没有可用性，不考虑
