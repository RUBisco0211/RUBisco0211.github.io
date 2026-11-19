import assert from 'node:assert/strict'
import { test } from 'node:test'
import { padEnd, stripAnsi, truncateTo, visibleWidth } from '../../src/term/width.ts'

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
  // 带颜色的字符串按可见宽度算，补的空格数量才正确
  assert.equal(visibleWidth(padEnd('\x1b[36m中\x1b[39m', 6)), 6)
})

test('padEnd 不会截断超长内容', () => {
  assert.equal(padEnd('abcdef', 3), 'abcdef')
})

test('truncateTo 按显示宽度截断并补省略号', () => {
  assert.equal(truncateTo('abcdef', 10), 'abcdef')
  assert.equal(truncateTo('abcdef', 4), 'abc…')
  // 中文占 2 列，只能放 1 个字 + 省略号
  assert.equal(truncateTo('中文中文', 4), '中…')
  assert.equal(truncateTo('abc', 0), '')
})
