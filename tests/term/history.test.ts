import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { SiteHistory } from '../../src/term/history.ts'

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

test('超出上限时丢最旧的', () => {
    const history = new SiteHistory(3)
    for (const cmd of ['a', 'b', 'c', 'd']) history.append(cmd)
    assert.deepEqual(history.entries, ['d', 'c', 'b'])
})
