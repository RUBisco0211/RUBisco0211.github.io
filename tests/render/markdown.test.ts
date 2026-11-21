import assert from 'node:assert/strict'
import { test } from 'vitest'
import { headingTitles, renderMarkdown } from '@/render/markdown.ts'
import { visibleWidth } from '@/render/width.ts'

/** 去掉 ANSI 和 OSC 8，只看文字 */
const plain = (text: string): string =>
    text.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '').replace(/\x1b\[[0-9;]*m/g, '')

test('标题保留 # 并加粗', () => {
    const out = renderMarkdown('## 安装示例')
    assert.equal(plain(out), '## 安装示例')
    assert.match(out, /\x1b\[1m/)
})

test('列表项逐行输出', () => {
    const lines = plain(renderMarkdown('- 第一\n- 第二')).split('\n')
    assert.equal(lines.length, 2)
    assert.match(lines[0]!, /第一/)
    assert.match(lines[1]!, /第二/)
})

test('代码块去掉围栏，显示语言标签', () => {
    const out = renderMarkdown('```sh\nbrew install demo\n```')
    const text = plain(out)
    assert.match(text, /brew install demo/)
    assert.match(text, /sh/)
    assert.doesNotMatch(text, /```/)
})

test('没有语言标注的代码块压暗', () => {
    const out = renderMarkdown('```\nplain text\n```')
    assert.match(out, /\x1b\[2mplain text\x1b\[22m/)
})

test('代码块按语言着色', () => {
    const out = renderMarkdown('```js\nconst a = 1 // 注释\n```')
    assert.match(out, /\x1b\[36mconst\x1b\[39m/) // 关键字青
    assert.match(out, /\x1b\[33m1\x1b\[39m/) // 数字黄
    assert.match(out, /\x1b\[2m\/\/ 注释\x1b\[22m/) // 注释暗
})

test('shell 代码块识别注释、变量和选项', () => {
    const out = renderMarkdown('```bash\nexport PATH=$HOME/bin # 说明\nls -la\n```')
    assert.match(out, /\x1b\[36mexport\x1b\[39m/)
    assert.match(out, /\x1b\[35m\$HOME\x1b\[39m/)
    assert.match(out, /\x1b\[2m# 说明\x1b\[22m/)
    assert.match(out, /\x1b\[36m -la\x1b\[39m/) // 选项按关键字上青色
})

test('diff 代码块整行着色', () => {
    const out = renderMarkdown('```diff\n+新增\n-删除\n@@ 1,2 @@\n```')
    assert.match(out, /\x1b\[32m\+新增\x1b\[39m/)
    assert.match(out, /\x1b\[31m-删除\x1b\[39m/)
    assert.match(out, /\x1b\[35m@@ 1,2 @@\x1b\[39m/) // section 上品红
})

test('行内代码、粗体、斜体、删除线都不留标记', () => {
    assert.equal(plain(renderMarkdown('用 `npm` 装')), '用 npm 装')
    assert.equal(plain(renderMarkdown('**粗** 和 *斜*')), '粗 和 斜')
    assert.equal(plain(renderMarkdown('~~删~~')), '删')
})

test('链接保留文字并用 OSC 8 包起来', () => {
    const out = renderMarkdown('见 [文档](https://example.com/doc)')
    assert.equal(plain(out), '见 文档')
    assert.match(out, /\x1b\]8;;https:\/\/example\.com\/doc\x1b\\/)
})

test('图片保留可点链接', () => {
    const withAlt = renderMarkdown('![截图](./a.png)')
    assert.match(withAlt, /\x1b\]8;;\.\/a\.png\x1b\\/)
    assert.match(plain(withAlt), /截图/)

    const noAlt = renderMarkdown('![](./assets/cover.png?v=2)')
    assert.match(noAlt, /\x1b\]8;;\.\/assets\/cover\.png\?v=2\x1b\\/)
    assert.match(plain(noAlt), /cover\.png/)
})

test('嵌套列表保持层级', () => {
    const lines = plain(renderMarkdown('- 外层\n  - 内层')).split('\n')
    const indent = (line: string): number => line.length - line.trimStart().length

    assert.equal(lines.length, 2)
    assert.ok(indent(lines[1]!) > indent(lines[0]!))
    assert.match(lines[1]!, /内层$/)
})

test('多余空行被折叠，行尾不留空白', () => {
    const out = renderMarkdown('第一段\n\n\n\n第二段')
    assert.equal(plain(out), '第一段\n\n第二段')
    assert.doesNotMatch(out, /[ \t]+$/m)
})

test('窄终端下把列压窄、单元格折行，而不是整个退化', () => {
    const table =
        '| 名称 | 说明 | 默认 |\n| --- | --- | --- |\n| 超时 | 等待上传完成的最长时间 | 30000 |'
    const rendered = plain(renderMarkdown(table, 30))
    const rows = rendered.split('\n')

    // 还是网格
    assert.ok(rows.some((line) => line.includes('│')))
    // 每行都不超过可用宽度
    for (const row of rows) assert.ok(visibleWidth(row) <= 30, row)
    // 长单元格被折成多行，内容没丢
    assert.match(rendered, /等待上传完成的/)
    assert.match(rendered, /最长时间/)
})

test('宽终端下表格画成网格', () => {
    const table = '| a | b |\n| --- | --- |\n| 1 | 2 |'
    const wide = plain(renderMarkdown(table, 80))
    assert.match(wide, /a\s+│\s+b/)
    assert.match(wide, /1\s+│\s+2/)
})

test('列太多压不下去时才退回竖向排布', () => {
    const header = '| a | b | c | d | e | f |\n| --- | --- | --- | --- | --- | --- |'
    const row = '\n| 一一一一 | 二二二二 | 三三三三 | 四四四四 | 五五五五 | 六六六六 |'
    const narrow = plain(renderMarkdown(`${header}${row}`, 20))
    assert.doesNotMatch(narrow, /│/)
    assert.match(narrow, /一一一一/)
})

test('width 为 0 时不限宽，表格始终画网格', () => {
    const table =
        '| 名称 | 说明 |\n| --- | --- |\n| 超时 | 很长很长很长很长很长很长很长的说明文字 |'
    assert.match(plain(renderMarkdown(table)), /│/)
})

test('空文档返回空串', () => {
    assert.equal(renderMarkdown(''), '')
    assert.equal(renderMarkdown('\n\n'), '')
})

test('表格缺列时不崩，缺失单元格当空处理', () => {
    const out = plain(renderMarkdown('| a | b |\n| --- | --- |\n| 1 |'))
    assert.match(out, /a\s*│\s*b/)
    assert.match(out, /1\s*│/)
})

test('未闭合代码围栏也能画出闭合的框', () => {
    const out = plain(renderMarkdown('```js\nconst a = 1'))
    assert.match(out, /┌.*js/)
    assert.match(out, /│ const a = 1/)
    assert.match(out, /└/)
})

test('setext 风格的标题也当成标题', () => {
    const out = plain(renderMarkdown('标题\n==='))
    assert.match(out, /# 标题/)
})

test('引用块加左侧竖线', () => {
    const out = plain(renderMarkdown('> 引用一行'))
    assert.match(out, /│ 引用一行/)
})

test('headingTitles 抽出带 # 前缀的标题', () => {
    assert.deepEqual(headingTitles('# 一级\n\n正文\n\n## 二级 **粗**\n\n### 三级'), [
        '# 一级',
        '## 二级 粗',
        '### 三级',
    ])
    assert.deepEqual(headingTitles('只有正文'), [])
})
