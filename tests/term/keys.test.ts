import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keyChord, lookupKey, resolveKeys } from '../../src/term/keys.ts'

/** 造一个只带必要字段的键盘事件 */
function press(key: string, mods: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
        key,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        ...mods,
    } as KeyboardEvent
}

test('没有修饰键时 chord 就是 event.key 本身', () => {
    assert.equal(keyChord(press('y')), 'y')
    assert.equal(keyChord(press('Escape')), 'Escape')
    assert.equal(keyChord(press('ArrowDown')), 'ArrowDown')
})

test('Shift+字母是大小写语义，不算修饰键', () => {
    // event.key 已经是 'G'，不能再拼成 'shift+g'，否则 G 的绑定会失配
    assert.equal(keyChord(press('G', { shiftKey: true })), 'G')
})

test('修饰键按固定顺序拼成 chord，键名小写', () => {
    assert.equal(keyChord(press('c', { metaKey: true })), 'meta+c')
    assert.equal(keyChord(press('C', { ctrlKey: true, shiftKey: true })), 'ctrl+shift+c')
    assert.equal(keyChord(press('ArrowDown', { shiftKey: true })), 'shift+arrowdown')
})

test('lookupKey 先按 chord 匹配，再退回 event.key', () => {
    const map = resolveKeys({
        copy: ['y', 'meta+c', 'ctrl+shift+c'],
        bottom: ['G', 'End'],
        down: ['j', 'ArrowDown'],
    })

    assert.equal(lookupKey(map, press('y')), 'copy')
    assert.equal(lookupKey(map, press('c', { metaKey: true })), 'copy')
    assert.equal(lookupKey(map, press('C', { ctrlKey: true, shiftKey: true })), 'copy')
    // 大写字母键走 event.key 那一级
    assert.equal(lookupKey(map, press('G', { shiftKey: true })), 'bottom')
    // 带修饰键但没绑定的组合退回裸键位
    assert.equal(lookupKey(map, press('ArrowDown', { shiftKey: true })), 'down')
    assert.equal(lookupKey(map, press('c', { altKey: true })), undefined)
})

test('同一个键位（含 chord）绑两个动作会直接抛错', () => {
    assert.throws(() => resolveKeys({ copy: ['ctrl+c'], quit: ['ctrl+c'] }), /按键冲突/)
})
