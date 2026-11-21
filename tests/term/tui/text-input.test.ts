import assert from 'node:assert/strict'
import { test } from 'vitest'
import { TextInput } from '@/term/tui/text-input.ts'

const key = (k: string, mods: Partial<KeyboardEvent> = {}): KeyboardEvent =>
    ({
        key: k,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        ...mods,
    }) as KeyboardEvent

test('可打印字符追加', () => {
    const input = new TextInput()
    assert.equal(input.handle(key('a')), true)
    assert.equal(input.handle(key('b')), true)
    assert.equal(input.value, 'ab')
})

test('Backspace 删一个', () => {
    const input = new TextInput('abc')
    assert.equal(input.handle(key('Backspace')), true)
    assert.equal(input.value, 'ab')
})

test('带 Ctrl/Meta/Alt 不消费', () => {
    const input = new TextInput()
    assert.equal(input.handle(key('c', { ctrlKey: true })), false)
    assert.equal(input.handle(key('c', { metaKey: true })), false)
    assert.equal(input.handle(key('c', { altKey: true })), false)
    assert.equal(input.value, '')
})

test('功能键不消费', () => {
    const input = new TextInput()
    assert.equal(input.handle(key('ArrowDown')), false)
    assert.equal(input.handle(key('Enter')), false)
    assert.equal(input.value, '')
})

test('set / clear', () => {
    const input = new TextInput('abc')
    input.set('xyz')
    assert.equal(input.value, 'xyz')
    input.clear()
    assert.equal(input.value, '')
})
