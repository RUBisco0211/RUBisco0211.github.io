import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clampOffset,
  createWheelAccumulator,
  pagerStatus,
  wheelLines,
} from '../../src/term/pager.ts'
import { visibleWidth } from '../../src/term/width.ts'

const plain = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

test('offset 被夹在 [0, total - height]', () => {
  assert.equal(clampOffset(-5, 100, 10), 0)
  assert.equal(clampOffset(50, 100, 10), 50)
  assert.equal(clampOffset(999, 100, 10), 90)
  // 内容比一屏还短时固定在顶部
  assert.equal(clampOffset(5, 3, 10), 0)
})

test('滚轮 delta 换算成小数行数', () => {
  // 一格约 100px，按 80px/行 算是 1.25 行
  assert.equal(wheelLines(100, 0), 1.25)
  assert.equal(wheelLines(-80, 0), -1)
  // 触控板的小增量不强行凑一行
  assert.ok(wheelLines(3, 0) < 1)
  assert.equal(wheelLines(4, 1), 4)
  assert.equal(wheelLines(1, 2), 10)
  assert.equal(wheelLines(0, 0), 0)
})

test('滚轮累积：攒够一行才滚', () => {
  const wheel = createWheelAccumulator(80)

  // 触控板连发 10 个 8px 的小事件 = 80px，正好滚一行
  let scrolled = 0
  for (let i = 0; i < 10; i += 1) scrolled += wheel.next(8)
  assert.equal(scrolled, 1)

  // 鼠标滚轮一格 100px → 1.25 行：前三次各滚 1 行，第四次攒到 2 行
  const mouse = createWheelAccumulator(80)
  assert.deepEqual(
    [mouse.next(100), mouse.next(100), mouse.next(100), mouse.next(100)],
    [1, 1, 1, 2],
  )

  // 攒着的余量可以丢掉
  const reset = createWheelAccumulator(80)
  reset.next(60)
  reset.reset()
  assert.equal(reset.next(60), 0)
})

test('状态栏整行铺满且反显', () => {
  const status = pagerStatus('从nvm迁移到fnm', 0, 100, 10, 60)
  assert.equal(visibleWidth(status), 60)
  assert.match(status, /^\x1b\[7m/)
  assert.match(status, /\x1b\[27m$/)
  assert.match(plain(status), /从nvm迁移到fnm/)
  assert.match(plain(status), /q 退出/)
})

test('状态栏显示百分比和行范围', () => {
  const status = plain(pagerStatus('t', 0, 100, 10, 80))
  assert.match(status, /10%/)
  assert.match(status, /1-10\/100/)

  const end = plain(pagerStatus('t', 90, 100, 10, 80))
  assert.match(end, /100%/)
  assert.match(end, /91-100\/100/)
})

test('内容不足一屏时算 100%', () => {
  assert.match(plain(pagerStatus('t', 0, 3, 10, 60)), /100%/)
})

test('标题太长时截断，不挤掉右边的进度', () => {
  const status = pagerStatus('很长'.repeat(40), 0, 100, 10, 40)
  assert.equal(visibleWidth(status), 40)
  assert.match(plain(status), /…/)
  assert.match(plain(status), /q 退出/)
})
