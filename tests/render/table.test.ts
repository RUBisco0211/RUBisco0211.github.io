import assert from 'node:assert/strict'
import { test } from 'node:test'
import { columnWidths, formatRow, formatTable, rowWidth } from '../../src/render/table.ts'

const strip = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

test('columnWidths 按显示宽度算，中文和颜色序列都正确处理', () => {
    const widths = columnWidths([
        ['ab', '中文'],
        ['c', '\x1b[36m红\x1b[39m'],
    ])
    assert.deepEqual(widths, [2, 4])
})

test('formatTable 按列补齐并裁掉行尾空白', () => {
    const lines = formatTable([
        ['a', '1'],
        ['bb', '2'],
        ['c', '3'],
    ])
    assert.deepEqual(lines, ['a   1', 'bb  2', 'c   3'])
})

test('formatRow 支持右对齐', () => {
    const line = formatRow(['x', '7'], [3, 3], { columns: [{}, { align: 'right' }] })
    assert.equal(line, 'x      7')
})

test('gap 可以按列边界不同', () => {
    const line = formatRow(['a', 'b', 'c'], [1, 1, 1], { gap: ['  ', ' '] })
    assert.equal(line, 'a  b c')
})

test('indent 作用在整行左侧', () => {
    const line = formatRow(['a', 'b'], [2, 1], { indent: '  ' })
    assert.equal(line, '  a   b')
})

test('widths 可以显式指定，覆盖自动测量', () => {
    const lines = formatTable([['a', 'b']], { widths: [4, 0] })
    assert.equal(lines[0], 'a     b')
})

test('rowWidth 把列宽和间距加总', () => {
    assert.equal(rowWidth([2, 3]), 7)
    assert.equal(rowWidth([2, 3], { gap: ' ' }), 6)
    assert.equal(rowWidth([2, 3, 1], { gap: ['  ', ' '] }), 9)
})

test('trim false 保留行尾补位', () => {
    const line = formatRow(['a', 'b'], [2, 2], { trim: false })
    assert.equal(line, 'a   b ')
})

test('带颜色的单元格按可见宽度对齐', () => {
    const line = formatRow(['\x1b[36m中\x1b[39m', 'x'], [4, 1])
    assert.equal(strip(line), '中    x')
})

test('空行（没有单元格）不炸', () => {
    assert.deepEqual(formatTable([[], ['a']]), ['', 'a'])
})
