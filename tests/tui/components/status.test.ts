import assert from 'node:assert/strict'
import { test } from 'vitest'
import { statusBar } from '@/tui/components/status.ts'
import { visibleWidth } from '@/render/width.ts'
import { MIN_COLS } from '@/term/size.ts'

const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

test('整行铺满且反显', () => {
    const status = statusBar({ left: '标题', right: '10%', cols: 40 })
    assert.equal(visibleWidth(status), 40)
    assert.match(status, /^\x1b\[7m/)
    assert.match(status, /\x1b\[27m$/)
    assert.match(plain(status), /标题/)
    assert.match(plain(status), /10%/)
})

test('提示放不下时从头部丢，q 退出留到最后', () => {
    const hints = ['j/k 行', '空格 翻页', 't 目录', '/ 搜索', 'q 退出']
    const wide = plain(statusBar({ left: '标题', right: '10%', hints, cols: 120 }))
    assert.match(wide, /j\/k 行/)
    assert.match(wide, /q 退出/)

    // 窄下来先丢 j/k 行
    const narrow = plain(statusBar({ left: '标题', right: '10%', hints, cols: 52 }))
    assert.doesNotMatch(narrow, /j\/k 行/)
    assert.match(narrow, /q 退出/)

    // 更窄只剩最后一个
    const tiny = plain(statusBar({ left: '标题', right: '10%', hints, cols: 34 }))
    assert.match(tiny, /q 退出/)
    assert.doesNotMatch(tiny, /t 目录/)
})

test('标题太长时截断，不挤掉右边的进度', () => {
    const status = statusBar({ left: '很长'.repeat(40), right: '10%', cols: 40 })
    assert.equal(visibleWidth(status), 40)
    assert.match(plain(status), /…/)
    assert.match(plain(status), /10%/)
})

test('从最小可用列宽起，状态栏任何宽度都不溢出', () => {
    const hints = ['j/k 行', '空格 翻页', 't 目录', '/ 搜索', 'y 复制', 'q 退出']
    for (let cols = MIN_COLS; cols <= 200; cols += 1) {
        const status = statusBar({
            left: '一篇很长很长的文章标题用来测试状态栏溢出',
            right: '10%  ·  1-10/1000',
            hints,
            cols,
        })
        assert.ok(visibleWidth(status) <= cols, `cols=${cols} 时状态栏 ${visibleWidth(status)} 列`)
    }
})
