# tty.blog

终端风格的个人静态站点，用命令浏览内容。

<https://rubisco0211.github.io/>

```
rubisco@tty.blog:~$ ls blog
类型  日期        字数  名称                          标签
post  2026-04-06  1.8k  从nvm迁移到fnm                nvm fnm
post  2026-01-05  1.2k  管理自己的GitHub项目          GitHub Git

rubisco@tty.blog:~$ cat blog/从nvm迁移到fnm
```

## 命令

| 命令           | 说明                               |
| -------------- | ---------------------------------- |
| `ansi`         | 演示 ANSI 颜色与样式               |
| `cat <文件>`   | 阅读文档                           |
| `cd [路径]`    | 切换目录                           |
| `clear`        | 清屏                               |
| `echo <文本…>` | 输出参数                           |
| `help [命令]`  | 列出可用命令，或查看某条命令的用法 |
| `history [-c]` | 浏览历史命令                       |
| `ls [路径]`    | 列出目录内容                       |
| `matrix`       | 数字雨                             |
| `neofetch`     | 显示个人、站点与终端信息           |
| `pwd`          | 显示当前目录                       |
| `search <词…>` | 搜索标题、标签和正文               |
| `stats`        | 站点统计                           |
| `tags [标签]`  | 标签列表                           |
| `theme [名字]` | 切换主题                           |
| `tree [路径]`  | 树形列出目录内容                   |

`Tab` 补全，`↑` `↓` 翻历史。

## 阅读器按键

| 键                       | 动作                        |
| ------------------------ | --------------------------- |
| 滚轮 / `j` `k` / `↑` `↓` | 滚动                        |
| `空格` / `b`             | 一屏                        |
| `d` / `u`                | 半屏                        |
| `g` / `G`                | 顶 / 底                     |
| `/`                      | 搜索，回车后 `n` `N` 前后跳 |
| `t`                      | 目录，按标题跳转            |
| `q` `Esc`                | 退出                        |

## 本地开发

需要 Node 26。

```bash
npm install
npm run dev       # http://localhost:5173
npm test
npm run build
```

## 写文章

见 [`docs/writing.md`](./docs/writing.md)。
