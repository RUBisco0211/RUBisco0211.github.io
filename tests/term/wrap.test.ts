import assert from 'node:assert/strict'
import { test } from 'node:test'
import { wrapAnsi } from '../../src/term/wrap.ts'
import { visibleWidth } from '../../src/term/width.ts'

const plain = (text: string): string =>
    text.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '').replace(/\x1b\[[0-9;]*m/g, '')

test('放得下就原样返回', () => {
    assert.deepEqual(wrapAnsi('abc', 10), ['abc'])
    assert.deepEqual(wrapAnsi('', 10), [''])
})

test('在空格处断行', () => {
    assert.deepEqual(wrapAnsi('aaa bbb ccc', 7), ['aaa bbb', 'ccc'])
})

test('词能整个挪到下一行时，不在词中间切', () => {
    // 宽度 6 时 "xx yyy" 已满，但 yyyyyy 整个放得下 → 应该回到空格处断
    assert.deepEqual(wrapAnsi('xx yyyyyy zz', 6), ['xx', 'yyyyyy', 'zz'])
    // 单行 66 字、宽 65：整词能放下就不能切在词中间
    const long = 'Automatically copy your image URLs right after finishing uploading'
    assert.deepEqual(wrapAnsi(long, 65), [
        'Automatically copy your image URLs right after finishing',
        'uploading',
    ])
})

test('没有空格时硬切', () => {
    const out = wrapAnsi('中文中文中文', 4)
    assert.equal(out.length, 3)
    for (const line of out) assert.ok(visibleWidth(line) <= 4)
})

test('中文按 2 列算宽度', () => {
    // 4 个中文 = 8 列，宽度 8 正好放下
    assert.deepEqual(wrapAnsi('中文中文', 8), ['中文中文'])
    // 宽度 7 就得拆
    assert.equal(wrapAnsi('中文中文', 7).length, 2)
})

test('不切断转义序列，且每行都重新打开样式', () => {
    const bold = `\x1b[1m${'a'.repeat(20)}\x1b[22m`
    const out = wrapAnsi(bold, 8)
    assert.ok(out.length >= 3)
    for (const line of out) {
        // 不能出现半条转义序列
        assert.doesNotMatch(line.replace(/\x1b\[[0-9;]*m/g, ''), /\x1b/)
        assert.equal(visibleWidth(line) <= 8, true)
    }
    // 第二行起要自己重新打开粗体
    assert.match(out[1]!, /^\x1b\[1m/)
})

test('折行后样式会被正确关闭，不会漏到下一行', () => {
    const out = wrapAnsi(`\x1b[31m${'x'.repeat(20)}\x1b[39m`, 5)
    for (const line of out.slice(0, -1)) assert.match(line, /\x1b\[0m$/)
})

test('OSC 8 链接跨行时两端都会重新包起来', () => {
    const link = `\x1b]8;;https://a.com\x1b\\${'y'.repeat(12)}\x1b]8;;\x1b\\`
    const out = wrapAnsi(link, 6)
    assert.ok(out.length >= 2)
    assert.match(out[1]!, /^\x1b\]8;;https:\/\/a\.com/)
    for (const line of out.slice(0, -1)) assert.match(line, /\x1b\]8;;\x1b\\$|\x1b\[0m$/)
})

test('宽字符不会被从中间劈开', () => {
    const out = wrapAnsi('中'.repeat(5), 3)
    for (const line of out) {
        assert.ok(visibleWidth(line) <= 3)
        assert.equal(plain(line).includes('\ufffd'), false)
    }
})
