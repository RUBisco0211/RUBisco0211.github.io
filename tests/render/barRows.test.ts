import assert from 'node:assert/strict'
import { test } from 'vitest'
import { barRows, type BarRow } from '@/render/barRows.ts'
import { visibleWidth } from '@/render/width.ts'
import { MIN_COLS } from '@/term/size.ts'

const strip = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')
const paint = (text: string): string => text

const rows = (): BarRow[] => [
    { label: 'a', value: 10, valueText: '10' },
    { label: 'b', value: 5, valueText: '5' },
]

test('空输入返回空', () => {
    assert.deepEqual(barRows([], { cols: 40, labelWidth: 4, paint }), [])
})

test('行数等于输入行数，且柱子按最大值为基准等比', () => {
    const lines = barRows(rows(), { cols: 60, labelWidth: 4, paint })
    assert.equal(lines.length, 2)
    const bars = lines.map((line) => (strip(line).match(/█/g) ?? []).length)
    assert.ok(bars[0]! > bars[1]!, '值大的柱子应该更长')
})

test('窄终端下柱宽被压到下限，不会撑破整行', () => {
    const lines = barRows(rows(), { cols: 20, labelWidth: 4, paint })
    for (const line of lines) assert.ok(visibleWidth(line) <= 20, line)
})

test('label 超宽时按 labelWidth 截断', () => {
    const lines = barRows([{ label: '非常非常长的标签', value: 1, valueText: '1' }], {
        cols: 40,
        labelWidth: 6,
        paint,
    })
    assert.ok(strip(lines[0]!).includes('…'))
})

test('paint / labelPaint 只改样式不改可见宽度', () => {
    const plainLines = barRows(rows(), { cols: 40, labelWidth: 4, paint })
    const styledLines = barRows(rows(), {
        cols: 40,
        labelWidth: 4,
        paint: (text) => `\x1b[32m${text}\x1b[39m`,
        labelPaint: (text) => `\x1b[36m${text}\x1b[39m`,
    })
    for (let i = 0; i < plainLines.length; i += 1) {
        assert.equal(strip(styledLines[i]!), strip(plainLines[i]!))
        assert.equal(visibleWidth(styledLines[i]!), visibleWidth(plainLines[i]!))
    }
})

test('valueText 右对齐：数值的右边线对齐', () => {
    const lines = barRows(
        [
            { label: 'a', value: 10, valueText: '9' },
            { label: 'b', value: 5, valueText: '100' },
        ],
        { cols: 40, labelWidth: 4, paint },
    )
    // 右对齐 = 数值末尾对齐行尾，两行宽度一致且都以自己的数值结尾
    assert.equal(visibleWidth(lines[0]!), visibleWidth(lines[1]!))
    assert.ok(strip(lines[0]!).endsWith('9'))
    assert.ok(strip(lines[1]!).endsWith('100'))
})

test('从最小可用列宽起，柱状行任何宽度都不溢出', () => {
    // MIN_COLS 是 main.ts 遮罩的门槛；达到它之后 barRows 必须自己撑住
    for (let cols = MIN_COLS; cols <= 200; cols += 1) {
        const labelWidth = Math.max(8, Math.floor((cols - 4) / 2))
        const lines = barRows(
            [
                { label: '非常长的标签名字', value: 12345, valueText: '12k' },
                { label: '短', value: 1, valueText: '1' },
            ],
            { cols, labelWidth, paint },
        )
        for (const line of lines) {
            assert.ok(visibleWidth(line) <= cols, `cols=${cols} 时行宽 ${visibleWidth(line)}`)
        }
    }
})
