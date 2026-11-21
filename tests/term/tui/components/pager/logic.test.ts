import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    cleanSelection,
    locateTitles,
    progress,
} from '../../../../../src/term/tui/components/pager/logic.ts'

test('cleanSelection 去掉行尾空白和末尾换行', () => {
    // xterm 的 buffer 行是空格填充的，选到行尾会带一串空白
    assert.equal(cleanSelection('foo   \nbar  \n\n'), 'foo\nbar')
    assert.equal(cleanSelection('code\t\t\n'), 'code')
    // 段落中间的空行要保留
    assert.equal(cleanSelection('a\n\nb'), 'a\n\nb')
    // 选中纯空白时得到空串，调用方据此跳过复制
    assert.equal(cleanSelection('   \n\n'), '')
})

test('cleanSelection 不留 CRLF 的 \\r', () => {
    assert.equal(cleanSelection('foo\r\nbar\r\n'), 'foo\nbar')
    assert.equal(cleanSelection('foo \r\nbar\t\r\n'), 'foo\nbar')
})

test('progress 显示百分比和行范围', () => {
    assert.equal(progress(0, 100, 10), '10%  ·  1-10/100')
    assert.equal(progress(90, 100, 10), '100%  ·  91-100/100')
})

test('progress 内容不足一屏时算 100%', () => {
    assert.equal(progress(0, 3, 10), '100%  ·  1-3/3')
})

test('progress offset+height 超过 total 时封顶 100%', () => {
    assert.equal(progress(95, 100, 6), '100%  ·  96-100/100')
})

test('locateTitles 把标题映射到行号，重复标题各自对上', () => {
    const lines = ['前言', '安装工具', '正文', '配置 shell', '安装工具']
    assert.deepEqual(locateTitles(lines, ['安装工具', '配置 shell']), [1, 3])
    // 第二次出现同一个标题时不会还指到第一处
    assert.deepEqual(locateTitles(lines, ['安装工具', '安装工具']), [1, 4])
})

test('找不到的标题返回 -1', () => {
    assert.deepEqual(locateTitles(['a'], ['没有这个']), [-1])
})

test('locateTitles 忽略行内 ANSI 和大小写', () => {
    const lines = ['\x1b[1m\x1b[36m安装工具\x1b[39m\x1b[22m']
    assert.deepEqual(locateTitles(lines, ['安装工具']), [0])
})
