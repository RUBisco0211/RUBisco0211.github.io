# AGENTS.md

终端风格的纯静态个人站点。没有导航栏、没有卡片列表，访客通过命令浏览内容。

这份文档记录**已经定下来的架构决策**。改动前先读「核心契约」。

## 文档索引

| 文档                   | 内容                                                  |
| ---------------------- | ----------------------------------------------------- |
| **AGENTS.md**（本文）  | 必读：目录结构、核心契约、开发命令、最容易踩的几个坑  |
| `docs/architecture.md` | 选型理由、TUI 组件、命令行着色、列对齐                |
| `docs/pitfalls.md`     | 全部踩坑记录（readline 私有 API、FitAddon、定时器等） |
| `docs/deployment.md`   | GitHub Pages 部署、`base` 路径                        |
| `docs/writing.md`      | 写文章：frontmatter、markdown 支持范围、图片放置      |
| `docs/non-goals.md`    | 明确不做的事                                          |

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
  term/               xterm 封装（Term，实现 TuiDriver）+ driver.ts（给 tui 的窄接口）+ 命令历史
  tui/                整屏 TUI 子系统（只依赖 term + render）
    canvas.ts         Canvas：纯画布
    session.ts        TuiSession：视图栈 + 会话生命周期
    view.ts           TuiView 接口
    components/       list / scroll / status / text-input
    views/            select.ts + pager.ts + matrix.ts
  shell/              tokenize / alias / registry / fs / path / complete / error
    commands/         一条命令一个文件 + 手动在 index.ts 注册
      utils/          命令间共享的辅助件（pager-input.ts：文档 → PagerInput；outline.ts：目录）
  content/            内容树视图、字数格式化、搜索
  theme/              themes/<名字>.ts（每套含 light/dark 两个变体）+ 聚合 + store
plugins/site-content.ts   content/ → virtual:site-tree
scripts/
  build-content.ts   内容编译器（被 dev 插件和 copy-content 共用）
  copy-content.ts    构建后把 .md 拷进 dist/content/
tests/                vitest，和 src 分开存放
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
  run(line): Promise<void> // 递归执行另一条命令（走完整 alias 展开和分发）
  prefill(line): void // 填到下一次提示符，让用户自己回车
}
```

- 命令**只依赖 `Ctx`**，不 import xterm、不 import 具体 store
- 输出一律走 `ctx.term.println()`。`ctx.term.write()` 是裸写，不经过 readline 记账，只在确定不和输入行打架时用
- 参数不足用 `printUsage(command)`，不要硬编码 `用法：…`（会和 `usage` 字段漂移）
- 错误：命令 `throw` 一个 `ShellError`（或 `fail(...)`），由 `shell.run()` 捕获后交给
  `term.printError()` 统一染红；可选提示用第二参数（如可选值列表）。意外异常不吞，继续抛给 `main.ts` 兜底。
  错误怎么渲染是终端层的事（`Term.printError`），shell 只给消息和提示。

### 2.1 依赖分两条通道：纯函数 vs 生命周期

命令用到的东西按「有没有状态」分成两类，**不要合并成一条通道**：

| 性质                                 | 例子                                                                               | 怎么拿                |
| ------------------------------------ | ---------------------------------------------------------------------------------- | --------------------- |
| **纯函数**（无状态、无 I/O、确定性） | `path.*`、`fs.buildFs/lookup/getNode`、`complete.*`、`fail/printUsage`             | 直接 `import`         |
| **有状态 / 生命周期**                | `term`、`theme`、`content`、`cwd`、`chdir`、`run`、`prefill`、`runPager`、`select` | 走 `ctx` 或显式传服务 |

- 纯函数直接 import，才能**脱离 shell 单测**（不用造 `Ctx`）。
- 有状态的东西走 `ctx`，才能**注入 / 替换 / mock**（`shell.test.ts` 的 fake term/theme/content）。
- **不要把纯函数挂到 `ctx` 上**（`ctx.completePath()` 之类）：`Ctx` 会变成 god object，纯函数测试也被迫造整个 shell。

**纯函数要收窄签名**：只收它真正需要的字段，不收整个 `Ctx`。

```ts
// 好：Ctx 结构上满足 { cwd, fs }，命令里 completePath(ctx, …) 原样可用
export function completePath(scope: { cwd: string; fs: Fs }, current: string): Completion[]
// 差：收了 9 个字段只用 2 个，测试被迫 createShell
export function completePath(ctx: Ctx, current: string): Completion[]
```

例外：`completeLine(ctx, line)` 确实需要完整 `Ctx`——它要读 `registry`/`config` 并分发给
`command.complete(ctx, …)`，收窄反而拆散逻辑。**判断标准是「它真正碰了几个字段」，不是一刀切。**

### 2.2 跨层功能分层组合，别让 term 认识 content

「把一篇文档丢进 pager」这类功能跨了 content / render / TUI，拆成两半：

- **tui** 只收通用的 `PagerInput`，入口 `runPager(term, input)`；不认识 `DocMeta`、frontmatter
- **content** 只管文档本身（`DocMeta`、markdown→ANSI、标题提取），**不认识 pager**
- **commands/utils/** 放命令间共享的适配器：`pager-input.ts` 的 `toPagerInput(doc, text, options): PagerInput`
- **命令** 组合：`await runPager(ctx.term, toPagerInput(doc, text))`

适配器归命令层（只有它同时认识 content 和 tui），不塞进 content 也不塞进 shell 根目录
（那是 tokenize/alias/registry 这类核心实现）。不单独开顶层的 `utils/` / `features/` 层，
也不让 term import content。

### 3. 命令注册是手动的

`src/shell/commands/index.ts` 显式 import 每条命令并拼成 `commands` 数组。
新增命令 = 新建 `commands/<name>.ts` + 在 `index.ts` 里加一行 import 和一个数组项。

不用 `import.meta.glob` 自动收集：显式列表能让 tsc 立刻发现漏接，顺序也完全可控。

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
- 命令接受相对路径、`~`、`..`，以及带 `.md` 后缀的写法（大小写不敏感）

### 7. 窄终端直接遮罩

字符网格在窄窗口里排不下（状态栏溢出、柱状图折行、表格对不齐）。所以不做逐组件降级，
而是统一门槛 `term/size.ts`：低于 `MIN_COLS`/`MIN_ROWS` 时 `main.ts` 盖上 `#size-mask`
并 `Term.enableInput(false)`，尺寸回来自动恢复。`statusBar`/`barRows` 只保证 ≥ 门槛时不溢出。

### 8. TUI / 着色 / 列对齐

细节见 `docs/architecture.md`。三条硬约束先记住：

- **TUI 组件**：一次全屏交互 = 一个 `TuiSession`，从构造（抢输入 + 进 alt screen）到 `close()`；
  会话内是视图栈，视图实现 `TuiView = { draw(canvas), key?(event, session), wheel?, done?, onShow?, onHide? }`，
  结束自己只 resolve `done`，弹栈/关会话由会话决定——视图不自己 show 自己。
  命令只看到 `select(term, ...)` / `runPager(term, ...)`（配 `toPagerInput`），
  不接触 alt screen / 输入锁 / resize。`captureInput` 排他，已接管时抛错；tui 只认 `TuiDriver` 接口。
- **命令行着色**：`highlightLine()` 只能往字符之间插样式，**绝不能增删字符**（去色后必须和原行逐字符一致）。
- **列对齐**：一律走 `render/table.ts`；单元格可带 ANSI/OSC 8，宽度按 `visibleWidth` 算，不做截断。

## 开发

```bash
npm run dev           # vite，改 content/ 会整页 reload
npm test              # vitest run
npm run typecheck     # tsc --noEmit
npm run build         # tsc + vite build + copy-content
npm run format        # prettier
```

测试用 **Vitest**：和 Vite 共享配置、插件与 `@/` 别名。

跨目录 import 一律用 `@/...`（如 `@/render/ansi.ts`），不再写 `../../`；同目录仍用 `./`。
别名键是 `@/` 而不是裸 `@`——否则 `@xterm/xterm` 这类 scoped 包会被前缀匹配掉。
Vite/Vitest 走 `vite.config.ts` 的 `resolve.alias`，tsc 不认它，所以 `tsconfig.json`
另配一份 `paths`（两份配置是 Vite+TS 的标准做法）。

相对 import 带 `.ts` 扩展名（tsconfig 开了 `allowImportingTsExtensions`）。

## 最容易踩的坑（全文见 `docs/pitfalls.md`）

1. **readline 私有 API**：`showCompletions`/`read` 依赖非公开接口，`tests/term/readline.test.mjs` 是**副本**，改 `terminal.ts` 必须手动同步。
2. **FitAddon 读父元素 padding**：终端必须放在无内边距的 `#term` 里，留白交给外层 `#app`。
3. **字体异步**：`document.fonts.ready` 和 `loadingdone` 都要重新 `fit()`。
4. **prettier 必须跑**：`.prettierrc` 定死无分号/单引号/printWidth 100。
5. **CJK 对齐用 `visibleWidth()`**，不要用 `text.length`。
6. **定时器要清干净**：退出路径 `clearTimeout` + 摘监听；用裸 `setTimeout`（测试在 node 跑）。
