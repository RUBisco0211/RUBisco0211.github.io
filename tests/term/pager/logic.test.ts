import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    cleanSelection,
    clampOffset,
    createWheelAccumulator,
    locateTitles,
    pagerStatus,
} from '../../../src/term/pager/logic.ts'
import { visibleWidth } from '../../../src/render/width.ts'
import { MIN_COLS, MIN_ROWS } from '../../../src/term/size.ts'

const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

test('offset 被夹在 [0, total - height]', () => {
    assert.equal(clampOffset(-5, 100, 10), 0)
    assert.equal(clampOffset(50, 100, 10), 50)
    assert.equal(clampOffset(999, 100, 10), 90)
    // 内容比一屏还短时固定在顶部
    assert.equal(clampOffset(5, 3, 10), 0)
})

test('滚轮累积：攒够一行才滚', () => {
    // 触控板连发 10 个 8px 的小事件 = 80px，正好滚一行
    const trackpad = createWheelAccumulator(80)
    let scrolled = 0
    for (let i = 0; i < 10; i += 1) scrolled += trackpad.next(8)
    assert.equal(scrolled, 1)

    // 鼠标滚轮一格 100px → 1.25 行：前三次各滚 1 行，第四次攒到 2 行
    const mouse = createWheelAccumulator(80)
    assert.deepEqual(
        [mouse.next(100), mouse.next(100), mouse.next(100), mouse.next(100)],
        [1, 1, 1, 2],
    )

    // deltaMode 1（行）和 2（页）直接换算
    assert.equal(createWheelAccumulator(80).next(4, 1), 4)
    assert.equal(createWheelAccumulator(80).next(1, 2), 10)

    // 攒着的余量可以丢掉
    const reset = createWheelAccumulator(80)
    reset.next(60)
    reset.reset()
    assert.equal(reset.next(60), 0)
})

test('状态栏整行铺满且反显', () => {
    const status = pagerStatus({
        title: '示例标题',
        offset: 0,
        total: 100,
        height: 10,
        cols: 60,
    })
    assert.equal(visibleWidth(status), 60)
    assert.match(status, /^\x1b\[7m/)
    assert.match(status, /\x1b\[27m$/)
    assert.match(plain(status), /示例标题/)
})

test('状态栏显示百分比和行范围', () => {
    const start = plain(pagerStatus({ title: 't', offset: 0, total: 100, height: 10, cols: 40 }))
    assert.match(start, /10%  ·  1-10\/100$/)

    const end = plain(pagerStatus({ title: 't', offset: 90, total: 100, height: 10, cols: 40 }))
    assert.match(end, /100%  ·  91-100\/100$/)
})

test('进度不是简单比例：offset+height 超过 total 时封顶 100%', () => {
    // 100 行内容里翻了 95 行，只显示 6 行：95+6=101 > 100，不能显示 101%
    assert.match(
        plain(pagerStatus({ title: 't', offset: 95, total: 100, height: 6, cols: 40 })),
        /100%  ·  96-100\/100$/,
    )
    // 同尺寸内容短于一屏
    assert.match(
        plain(pagerStatus({ title: 't', offset: 0, total: 3, height: 10, cols: 40 })),
        /100%  ·  1-3\/3$/,
    )
})

test('内容不足一屏时算 100%', () => {
    assert.match(
        plain(pagerStatus({ title: 't', offset: 0, total: 3, height: 10, cols: 60 })),
        /100%/,
    )
})

test('标题太长时截断，不挤掉右边的进度', () => {
    const status = pagerStatus({
        title: '很长'.repeat(40),
        offset: 0,
        total: 100,
        height: 10,
        cols: 40,
    })
    assert.equal(visibleWidth(status), 40)
    assert.match(plain(status), /…/)
    assert.match(plain(status), /10%/)
})

test('提示放不下时从最不重要的开始丢，q 退出留到最后', () => {
    const hints = ['j/k 行', '空格 翻页', 't 目录', '/ 搜索', 'q 退出']
    const wide = plain(
        pagerStatus({ title: '标题', offset: 0, total: 100, height: 10, cols: 120, hints }),
    )
    assert.match(wide, /j\/k 行/)
    assert.match(wide, /q 退出/)

    // 窄下来先丢 j/k 行，再丢空格翻页
    const narrow = plain(
        pagerStatus({ title: '标题', offset: 0, total: 100, height: 10, cols: 52, hints }),
    )
    assert.doesNotMatch(narrow, /j\/k 行/)
    assert.match(narrow, /q 退出/)

    // 更窄只剩最后一个
    const tiny = plain(
        pagerStatus({ title: '标题', offset: 0, total: 100, height: 10, cols: 34, hints }),
    )
    assert.match(tiny, /q 退出/)
    assert.doesNotMatch(tiny, /t 目录/)
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

test('从最小可用列宽起，状态栏任何宽度都不溢出', () => {
    const hints = ['j/k 行', '空格 翻页', 't 目录', '/ 搜索', 'y 复制', 'q 退出']
    for (let cols = MIN_COLS; cols <= 200; cols += 1) {
        const status = pagerStatus({
            title: '一篇很长很长的文章标题用来测试状态栏溢出',
            offset: 0,
            total: 1000,
            height: Math.max(1, MIN_ROWS - 1),
            cols,
            hints,
        })
        assert.ok(visibleWidth(status) <= cols, `cols=${cols} 时状态栏 ${visibleWidth(status)} 列`)
    }
})
