# 容易踩的坑

这些坑都真实发生过。改对应模块前先看一眼。

## 1. readline 的私有 API

`Term.showCompletions()` 用的是 `printPrompt` + `state.reanchor`（没有公开的「打印并重绘」接口）；
`Term.read(prompt, initial)` 靠"排一个空 write 再 updateLine"来等 readline 建好 state。

`tests/term/readline.test.mjs` 里有一份同样的调用序列——它是**副本**，改 `terminal.ts` 时必须手动同步，
否则测试全绿但行为已坏（已经发生过一次）。

## 2. FitAddon 读的是父元素的 computed `height`

它只扣掉 `.xterm` 自己的 padding，**不管父元素的 padding**。所以终端必须放在无内边距的 `#term` 里，
留白由外层 `#app` 负责。否则会多算出行数，最后一行被裁掉。

## 3. 字体是异步的

首帧用回退字体算出的行高偏小，真字体到位后单元格变高，屏幕会超出容器。
所以 `Term` 在 `document.fonts.ready` 和 `loadingdone` 时都要重新 `fit()`。

## 4. prettier 必须跑

`terminal.ts` 曾被编辑器改成双引号 + 分号，导致脚本替换静默失败、改动没生效。
`.prettierrc` 已定死：无分号、单引号、printWidth 100。`content/` 不在格式化范围内（手写内容）。

## 5. CJK 对齐要用 `visibleWidth()`

按 `text.length` 算会把中文和 ANSI 转义序列一起算错。对齐用 `padEnd()`（在 `src/render/width.ts`）。

## 6. `clear` 的时机

`xterm.clear()` 会让 readline 的 `promptMarker` 失效，只能在两次 `read()` 之间调用。

## 7. 回车后命令行不带颜色

readline 提交前会调 `State.refreshUnhighlighted()` 把这行重绘成无样式。试过覆盖它让颜色保留，
但那是改库的内部行为，权衡后撤掉了（`tests/term/readline.test.mjs` 里那条用例记录着默认行为）。

## 8. 定时器要清干净

`MatrixView` 的逐帧动画、`TuiSession` 的 resize 防抖和 flash 都用 `setTimeout`。退出路径必须
`clearTimeout` + 摘掉 `captureInput`/`onResize` 的监听，否则退出后还在往终端写东西。用裸
`setTimeout` 而不是 `window.setTimeout`——测试在 node 里跑，`window` 不存在。
`TuiSession.close()` 统一清它自己的定时器并归还输入；视图自己起的定时器在 `onHide` 里清
（`MatrixView` 就是 `onHide` 停帧、`onShow` 重启）。
