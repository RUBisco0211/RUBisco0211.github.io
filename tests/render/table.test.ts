import assert from 'node:assert/strict'
import { test } from 'node:test'
import { columnWidths, formatRow, formatTable, rowWidth } from '../../src/render/table.ts'
import { stripAnsi } from '../../src/render/width.ts'

test('列宽按显示宽度算，中文和颜色序列都不算多', () => {
    assert.deepEqual(
        columnWidths([
            ['ab', '中文'],
            ['c', '\x1b[36m红\x1b[39m'],
        ]),
        [2, 4],
    )
})

test('按列补齐、右对齐、裁掉行尾空白', () => {
    const lines = formatTable([
        ['a', '1'],
        ['bb', '20'],
    ])
    assert.deepEqual(lines, ['a   1', 'bb  20'])

    const right = formatRow(['x', '7'], [3, 3], { columns: [{}, { align: 'right' }] })
    assert.equal(right, 'x      7')
})

test('gap 可以逐列不同', () => {
    assert.equal(formatRow(['a', 'b', 'c'], [1, 1, 1], { gap: ['  ', ' '] }), 'a  b c')
})

test('带颜色的单元格对齐不错位', () => {
    const line = formatRow(['\x1b[36m中\x1b[39m', 'x'], [4, 1])
    assert.equal(stripAnsi(line), '中    x')
})

test('rowWidth 把列宽和间距加总', () => {
    assert.equal(rowWidth([2, 3]), 7)
    assert.equal(rowWidth([2, 3, 1], { gap: ['  ', ' '] }), 9)
})
