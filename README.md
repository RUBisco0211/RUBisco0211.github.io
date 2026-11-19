# tty.blog

终端风格的个人静态站点。没有导航栏、没有卡片列表——访问者用命令浏览内容。

**线上：<https://rubisco0211.github.io/>**

```
rubisco@tty.blog:~$ ls blog
类型  日期        字数  名称                          标签
post  2026-04-06  1.8k  从nvm迁移到fnm                nvm fnm
post  2026-01-05  1.2k  管理自己的GitHub项目          GitHub Git

rubisco@tty.blog:~$ cat blog/从nvm迁移到fnm
```

## 命令

| 命令           | 说明                                       |
| -------------- | ------------------------------------------ |
| `ansi`         | 演示 ANSI 颜色与样式                       |
| `cat <文件>`   | 阅读文档（整屏 pager）                     |
| `cd [路径]`    | 切换目录                                   |
| `clear`        | 清屏                                       |
| `echo <文本…>` | 输出参数                                   |
| `help [命令]`  | 列出可用命令，或查看某条命令的用法         |
| `history [-c]` | 浏览历史命令，选中后填到提示符里           |
| `ls [路径]`    | 列出目录内容                               |
| `matrix`       | 数字雨（彩蛋）                             |
| `neofetch`     | 显示个人、站点与终端信息                   |
| `pwd`          | 显示当前目录                               |
| `search <词…>` | 搜索标题、标签和正文                       |
| `stats`        | 站点统计：按月分布、篇幅排行               |
| `tags [标签]`  | 标签列表，带上名字只看该标签下的文章       |
| `theme [名字]` | 切换主题（不带参数是可选列表，移动即预览） |
| `tree [路径]`  | 树形列出目录内容                           |

输入时按 `Tab` 补全，`↑` `↓` 翻历史。别名在 `src/config.ts` 里配置（默认 `blog` / `proj` / `clr` / `his`）。

## 阅读器按键

| 键                                   | 动作                        |
| ------------------------------------ | --------------------------- |
| 滚轮 / `j` `k` `↑` `↓`               | 滚动                        |
| `空格` `f` `PageDown` / `b` `PageUp` | 一屏                        |
| `d` / `u`                            | 半屏                        |
| `g` `Home` / `G` `End`               | 顶 / 底                     |
| `/`                                  | 搜索，回车后 `n` `N` 前后跳 |
| `t`                                  | 目录（按标题跳转）          |
| `q` `Esc`                            | 退出                        |

## 本地开发

需要 Node 26（测试用 `node --test` 直接跑 TypeScript，依赖原生类型剥离）。

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 188 项单测
npm run build        # tsc + vite build + 拷贝正文到 dist/content
npm run preview      # 预览构建产物
```

## 写文章

见 [`docs/writing.md`](./docs/writing.md)。简单说：在 `content/blog/<slug>/index.md` 放一个带 frontmatter 的 markdown，刷新页面它就出现在 `ls blog` 里。

## 部署

推送到 `main` 触发 `.github/workflows/deploy.yml`：跑测试 → 构建 → 发布到 GitHub Pages。

仓库必须叫 `RUBisco0211.github.io`（用户页），所以站点挂在根路径，`vite.config.ts` 的 `base` 保持默认 `/`。如果哪天改成项目页（`<user>.github.io/<repo>`），要同步设 `base: '/<repo>/'`——正文和静态资源都靠 `import.meta.env.BASE_URL` 拼路径。

## 目录结构

```
content/          文章（路径即身份）
public/           静态资源：字体、favicon、neofetch 的 ASCII art
src/term/         xterm 封装、ANSI、宽度、折行、pager、选择器
src/shell/        路径、虚拟文件系统、补全、alias、命令
src/content/      内容编译器产物、markdown→ANSI、语法着色、搜索
src/theme/        六套主题，每套自带深浅两个变体
plugins/          Vite 插件：content/ → virtual:site-tree
scripts/          构建期脚本
tests/            和 src 分开存放
```

架构契约、容易踩的坑、明确不做的事，都在 [`AGENTS.md`](./AGENTS.md)。

## 已知限制

- **移动端不考虑**。字符网格在小屏上没有可用性，这个站点是给桌面终端用的。
- **图片显示成可点链接**（`[图片: 文件名]`）。字符网格里画不了图，点开看原图。
- **宽表格会退化**成竖向的 key/value 排布（列压不下去时）。
- **没有管道和重定向**，`cat a | grep b` 跑不通；用 `search` 代替。
- **执行过的命令行不带颜色**——readline 在回车前会把这一行重绘成无样式再冻进 scrollback。
