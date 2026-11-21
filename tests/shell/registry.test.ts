import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createRegistry } from '@/shell/registry.ts'
import type { Command } from '@/shell/types.ts'

const cmd = (name: string): Command => ({ name, description: '', run() {} })

test('按名字查找命令', () => {
    const registry = createRegistry([cmd('ls'), cmd('cat')])
    assert.equal(registry.get('ls')?.name, 'ls')
    assert.equal(registry.get('nope'), undefined)
})

test('list 按名字排序，不依赖注入顺序', () => {
    const registry = createRegistry([cmd('zoo'), cmd('alpha'), cmd('beta')])
    assert.deepEqual(registry.names(), ['alpha', 'beta', 'zoo'])
})

test('命令名重复直接抛错', () => {
    assert.throws(() => createRegistry([cmd('ls'), cmd('ls')]), /命令名重复：ls/)
})
