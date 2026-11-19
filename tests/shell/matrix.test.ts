import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advance, columnCells, isDone, makeColumn } from '../../src/shell/commands/matrix.ts'
import type { Column } from '../../src/shell/commands/matrix.ts'

const column = (head: number, length: number, step = 1): Column => ({
  head,
  step,
  length,
  trail: Array.from({ length }, (_, i) => String(i)),
})

test('头部最亮，尾巴越往后越暗', () => {
  const cells = columnCells(column(5, 6), 10)
  assert.deepEqual(
    cells.map((cell) => cell.row),
    [5, 4, 3, 2, 1, 0],
  )
  assert.deepEqual(
    cells.map((cell) => cell.level),
    [0, 1, 2, 2, 2, 2],
  )
})

test('超出屏幕的格子不返回', () => {
  // 头在第 1 行、尾巴 5 格 → 只有 1、0 两行在屏幕内
  assert.deepEqual(
    columnCells(column(1, 5), 10).map((cell) => cell.row),
    [1, 0],
  )
})

test('头部还在屏幕上方时一个格子都不画', () => {
  assert.deepEqual(columnCells(column(-3, 5), 10), [])
})

test('头部已经沉到底部时只画还看得见的部分', () => {
  const cells = columnCells(column(11, 5), 12)
  assert.deepEqual(
    cells.map((cell) => cell.row),
    [11, 10, 9, 8, 7],
  )
})

test('advance 让头下移，并换掉尾巴第一个字符', () => {
  const before = column(2, 3)
  const after = advance(before)
  assert.equal(after.head, 3)
  assert.equal(after.trail.length, 3)
  assert.equal(after.trail[1], before.trail[0])
  assert.equal(after.trail[2], before.trail[1])
})

test('step 为 2 时一帧走两格', () => {
  assert.equal(advance(column(0, 3, 2)).head, 2)
})

test('整条尾巴出屏才算结束', () => {
  assert.equal(isDone(column(8, 5), 12), false)
  // head - length >= rows 才算整条出屏
  assert.equal(isDone(column(16, 5), 12), false)
  assert.equal(isDone(column(17, 5), 12), true)
})

test('makeColumn 的尾巴长度合理且不超过屏幕一半', () => {
  for (let i = 0; i < 20; i += 1) {
    const made = makeColumn(24)
    assert.ok(made.length >= 4)
    assert.ok(made.length <= Math.max(4, 12) + 4)
    assert.equal(made.trail.length, made.length)
  }
})
