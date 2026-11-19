import assert from 'node:assert/strict'
import { test } from 'node:test'
import { highlightLine, looksLikePath } from '../../src/shell/highlight-line.ts'
import type { PathKind } from '../../src/shell/highlight-line.ts'

const strip = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const classify = {
  isCommand: (name: string) => ['ls', 'cat', 'cd', 'theme'].includes(name),
  isAlias: (name: string) => name === 'posts',
  resolvePath: (token: string): PathKind => {
    if (token === 'blog/' || token === 'blog') return 'dir'
    if (token === 'blog/a.md') return 'file'
    return 'missing'
  },
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
  const out = highlightLine('echo "hello world"', classify)
  assert.match(out, /\x1b\[32m"hello world"\x1b\[39m/)
})

test('路径按存在与否着色', () => {
  // 目录青，文件默认，不存在的红
  assert.match(highlightLine('cd blog/', classify), /\x1b\[36mblog\/\x1b\[39m/)
  assert.doesNotMatch(highlightLine('cat blog/a.md', classify), /\x1b\[31m/)
  assert.match(highlightLine('cat nope/x', classify), /\x1b\[31mnope\/x\x1b\[39m/)
})

test('普通词不当作路径，不会被误标红', () => {
  assert.doesNotMatch(highlightLine('theme github', classify), /\x1b\[31m/)
})

test('looksLikePath 只认显式的路径写法', () => {
  assert.equal(looksLikePath('blog/'), true)
  assert.equal(looksLikePath('./x'), true)
  assert.equal(looksLikePath('~/x'), true)
  assert.equal(looksLikePath('github'), false)
  assert.equal(looksLikePath('-l'), false)
})
