import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'vitest'
import { SiteHistory } from '@/term/history.ts'
import { installFakeStorage } from '../helpers/fakeStorage.ts'

let storage: Storage
let restore: () => void

beforeEach(() => {
    ;({ storage, restore } = installFakeStorage())
})

afterEach(() => {
    restore()
})

test('写入落在带前缀的 key 上', () => {
    const history = new SiteHistory(10)
    history.append('ls')
    history.append('cat about')

    assert.equal(storage.getItem('history'), null)
    assert.deepEqual(JSON.parse(storage.getItem('tty.blog:history')!), ['cat about', 'ls'])
})

test('从带前缀的 key 恢复', () => {
    storage.setItem('tty.blog:history', '["pwd","ls"]')
    const history = new SiteHistory(10)
    history.restoreFromLocalStorage()
    assert.deepEqual(history.entries, ['pwd', 'ls'])
})

test('把旧的裸 history 迁移过来并删除', () => {
    storage.setItem('history', '["老命令"]')
    const history = new SiteHistory(10)
    history.restoreFromLocalStorage()

    assert.deepEqual(history.entries, ['老命令'])
    assert.equal(storage.getItem('history'), null)

    // 迁移后再写，落点也是新 key
    history.append('新命令')
    assert.deepEqual(JSON.parse(storage.getItem('tty.blog:history')!), ['新命令', '老命令'])
})

test('已有新 key 时不看旧 key', () => {
    storage.setItem('tty.blog:history', '["新"]')
    storage.setItem('history', '["旧"]')
    const history = new SiteHistory(10)
    history.restoreFromLocalStorage()
    assert.deepEqual(history.entries, ['新'])
})

test('坏 JSON 清空并重置', () => {
    storage.setItem('tty.blog:history', '{不是数组')
    const history = new SiteHistory(10)
    history.restoreFromLocalStorage()
    assert.deepEqual(history.entries, [])
    assert.equal(storage.getItem('tty.blog:history'), '[]')
})

test('数组里混了非字符串也重置', () => {
    storage.setItem('tty.blog:history', '["ok",1]')
    const history = new SiteHistory(10)
    history.restoreFromLocalStorage()
    assert.deepEqual(history.entries, [])
    assert.equal(storage.getItem('tty.blog:history'), '[]')
})
