import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import {
  STORAGE_PREFIX,
  readStored,
  removeStored,
  storageKey,
  takeLegacy,
  writeStored,
} from '../src/storage.ts'

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage
}

const original = (globalThis as { localStorage?: Storage }).localStorage
let storage: Storage

beforeEach(() => {
  storage = fakeStorage()
  ;(globalThis as { localStorage?: Storage }).localStorage = storage
})

afterEach(() => {
  ;(globalThis as { localStorage?: Storage }).localStorage = original
})

test('所有 key 都带前缀', () => {
  assert.equal(storageKey('theme'), 'tty.blog:theme')
  assert.equal(STORAGE_PREFIX, 'tty.blog:')
})

test('读写删都走带前缀的 key', () => {
  writeStored('theme', 'tokyo')
  assert.equal(readStored('theme'), 'tokyo')
  assert.equal(storage.getItem('theme'), null) // 裸 key 不出现
  assert.equal(storage.getItem('tty.blog:theme'), 'tokyo')

  removeStored('theme')
  assert.equal(readStored('theme'), null)
})

test('没存过时返回 null', () => {
  assert.equal(readStored('nope'), null)
})

test('takeLegacy 读出旧值并删除裸 key', () => {
  storage.setItem('history', '["ls"]')
  assert.equal(takeLegacy('history'), '["ls"]')
  assert.equal(storage.getItem('history'), null)
  assert.equal(takeLegacy('history'), null)
})

test('localStorage 不可用时静默降级', () => {
  ;(globalThis as { localStorage?: Storage }).localStorage = undefined
  assert.equal(readStored('theme'), null)
  assert.doesNotThrow(() => writeStored('theme', 'x'))
  assert.doesNotThrow(() => removeStored('theme'))
  assert.equal(takeLegacy('history'), null)
})
