import assert from 'node:assert/strict'
import { test } from 'vitest'
import { padEnd, stripAnsi, truncateTo, visibleWidth } from '@/render/width.ts'

test('ASCII 按字符数算', () => {
    assert.equal(visibleWidth('abc'), 3)
    assert.equal(visibleWidth(''), 0)
})

test('中文和全角标点按 2 列算', () => {
    assert.equal(visibleWidth('中文'), 4)
    assert.equal(visibleWidth('类型'), 4)
    assert.equal(visibleWidth('，。'), 4)
    assert.equal(visibleWidth('a中b'), 4)
})

test('忽略 SGR 颜色序列', () => {
    assert.equal(visibleWidth('\x1b[36mblog/\x1b[39m'), 5)
    assert.equal(visibleWidth('\x1b[1m\x1b[31m红\x1b[39m\x1b[22m'), 2)
})

test('忽略 OSC 8 超链接序列', () => {
    assert.equal(visibleWidth('\x1b]8;;https://example.com\x1b\\文字\x1b]8;;\x1b\\'), 4)
})

test('stripAnsi 只去转义，不动文字', () => {
    assert.equal(stripAnsi('\x1b[2m暗\x1b[22m'), '暗')
    assert.equal(stripAnsi('\x1b]8;;https://a\x1b\\链接\x1b]8;;\x1b\\'), '链接')
})

test('padEnd 按显示宽度补空格', () => {
    assert.equal(padEnd('ab', 4), 'ab  ')
    assert.equal(padEnd('中文', 4), '中文')
    assert.equal(padEnd('中', 4), '中  ')
    // 带颜色的字符串按可见宽度算，补的空格数量才正确（构造字面期望，不依赖 visibleWidth）
    assert.equal(padEnd('\x1b[36m中\x1b[39m', 6), '\x1b[36m中\x1b[39m    ')
    // 转义序列不能算进宽度，卡在关键分界点
    assert.equal(padEnd('\x1b[36m中\x1b[39m', 2), '\x1b[36m中\x1b[39m')
    assert.equal(padEnd('\x1b[36m中\x1b[39m', 3), '\x1b[36m中\x1b[39m ')
    // 同样不依赖 visibleWidth：OSC 8 链接也只算可见宽度
    assert.equal(
        padEnd('\x1b]8;;https://a\x1b\\b\x1b]8;;\x1b\\', 3),
        '\x1b]8;;https://a\x1b\\b\x1b]8;;\x1b\\  ',
    )
})

test('padEnd 不会截断超长内容', () => {
    assert.equal(padEnd('abcdef', 3), 'abcdef')
})

test('emoji 按 2 列算', () => {
    assert.equal(visibleWidth('😀'), 2)
    assert.equal(visibleWidth('a😀b'), 4)
})

test('组合字符 / 零宽字符不占列', () => {
    // 组合用声调符号接在 e 后面，终端只显示一个字符
    assert.equal(visibleWidth('e\u0301'), 1)
    assert.equal(visibleWidth('\u200b'), 0)
})

test('tab 没有列位置信息，按 1 列近似（已知限制）', () => {
    // 真实的 tab 要展开到下一个 tab stop，宽度取决于当前列，visibleWidth 拿不到
    // 这个信息。内容里不写 tab，所以不展开，钉住现状。
    assert.equal(visibleWidth('\t'), 1)
    assert.equal(visibleWidth('a\tb'), 3)
})

test('truncateTo 按显示宽度截断并补省略号', () => {
    assert.equal(truncateTo('abcdef', 10), 'abcdef')
    assert.equal(truncateTo('abcdef', 4), 'abc…')
    // 中文占 2 列，只能放 1 个字 + 省略号
    assert.equal(truncateTo('中文中文', 4), '中…')
    assert.equal(truncateTo('abc', 0), '')
})

test('truncateTo 不会切出超过宽度的宽字符', () => {
    assert.equal(truncateTo('😀', 1), '…')
    assert.equal(truncateTo('中文', 3), '中…')
    assert.equal(truncateTo('中', 1), '…')
})
