import assert from 'node:assert/strict'
import { test } from 'node:test'
import { highlightLine } from '../../src/shell/highlight-line.ts'

const strip = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const classify = {
  isCommand: (name: string) => ['ls', 'cat', 'cd', 'theme'].includes(name),
  isAlias: (name: string) => name === 'posts',
}

test('可见字符必须和输入完全一致', () => {
  for (const line of ['', '   ', 'ls -l', 'cat "a b"  --x', 'nope /a/../b  ']) {
    assert.equal(strip(highlightLine(line, classify)), line)
  }
})

test('认得的命令青色，别名品红，不认识的红色', () => {
  assert.match(highlightLine('ls', classify), /^\x1b\[36mls\x1b\[39m$/)
  assert.match(highlightLine('posts', classify), /^\x1b\[35mposts\x1b\[39m$/)
  assert.match(highlightLine('nope', classify), /^\x1b\[31mnope\x1b\[39m$/)
})

test('选项着黄色', () => {
  const out = highlightLine('ls -l --sort=date', classify)
  assert.match(out, /\x1b\[33m-l\x1b\[39m/)
  assert.match(out, /\x1b\[33m--sort=date\x1b\[39m/)
})

test('引号里的内容着绿色', () => {
  assert.match(highlightLine('echo "hello world"', classify), /\x1b\[32m"hello world"\x1b\[39m/)
})

test('参数和路径一律不着色', () => {
  const out = highlightLine('cat blog/从nvm迁移到fnm', classify)
  assert.equal(out.replace(/\x1b\[[0-9;]*m/g, ''), 'cat blog/从nvm迁移到fnm')
  // 只有命令本身带样式
  assert.equal((out.match(/\x1b\[3[0-7]m/g) ?? []).length, 1)
})
