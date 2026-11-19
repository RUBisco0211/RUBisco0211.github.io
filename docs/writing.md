# 写文章

`content/` 是站点唯一的内容来源。**路径即身份**：文件放在哪，它就在虚拟文件系统的哪。

```
content/
  about.md                     →  cat about
  blog/从nvm迁移到fnm/index.md  →  cat blog/从nvm迁移到fnm
  blog/enhance/index.md        →  cat blog/enhance
  blog/enhance/assets/*.png    →  和正文同目录的附件
  projects/unipac/index.md     →  cat projects/unipac
```

- 推荐 `docs/` 式的目录结构：一个文章一个文件夹，文件夹里放 `index.md` 和它的图片。
- 直接放 `content/about.md` 也行，路径就是 `about`。
- 想再套一层目录（`content/blog/2026/hello/index.md`）也支持，`ls` 和 `tree` 会自动出现中间目录。

保存后 Vite 会整页 reload，`ls blog` 立刻能看到。

## 博客的 frontmatter

```md
---
title: 从nvm迁移到fnm
description: 一句话简介，会显示在阅读器顶部
pubDate: 2026-04-06
tags: ['nvm', 'fnm']
---

正文从这里开始，正常写 markdown 就行。
```

| 字段          | 必填 | 说明                                                                 |
| ------------- | ---- | -------------------------------------------------------------------- |
| `title`       | 建议 | 阅读器标题。不写就用文件夹名                                         |
| `description` | 否   | 简介，`cat` 和阅读器都会显示                                         |
| `pubDate`     | 建议 | `YYYY-MM-DD`，`ls` 的日期列、`stats` 的按月分布、`tags` 的排序都用它 |
| `tags`        | 否   | 字符串数组，`tags` 命令和 `search` 会用到                            |
| `draft`       | 否   | `true` 时整篇不参与编译，构建日志里会报跳过数量                      |

## 项目的 frontmatter

项目没有固定 schema，只有两个约定：`name`（当标题用）和一个可选的 `description`。**frontmatter 里其他字段都会原样显示**在 `cat` 的头部和阅读器的信息表里：

```md
---
name: UniPac
description: 一站式全局包管理器
githubUrl: https://github.com/…
website: https://github.com/…
star: 7
fork: 8
---

正文（通常直接贴 README）。
```

`cat projects/unipac` 会把上面这些字段按顺序铺开，`https://` 开头的值在阅读器里是可点链接。

## markdown 支持到什么程度

渲染器是自己写的（`src/content/render.ts`），走 `marked` 的 token 树，支持：

- 标题、段落、粗体/斜体/删除线、行内代码、链接（OSC 8 可点）
- 有序/无序列表（含嵌套）、引用、分隔线
- 代码块——按语言做语法着色（shell / js / ts / json / yaml / diff / go / python / md）
- 表格——会先压列宽、让单元格折行；压不下去才退化成竖向排布
- 图片——降级成 `[图片: 文件名]` 的可点链接

**不支持的**：原始 HTML 标签（会被丢掉）、脚注、数学公式、目录指令。

## 图片放哪

和正文同目录，用相对路径引用：

```
content/blog/enhance/index.md
content/blog/enhance/assets/cover.png
```

注意：终端里图片只能显示成链接，**而且相对路径的链接目前指向不对**（会 404）。想让人点到图，用完整的 `https://` 地址。

## 加完文章之后

```bash
npm test             # 内容不影响测试，跑一下心里有底
npm run dev          # 本地看效果
git add content && git commit -m "content: 新文章"
git push             # 自动部署
```
