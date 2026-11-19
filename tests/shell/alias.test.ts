import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAliasExpander } from '../../src/shell/alias.ts'
import { tokenize } from '../../src/shell/tokenize.ts'

test('tokenize 拆词并支持成对引号', () => {
  assert.deepEqual(tokenize('ls -l'), ['ls', '-l'])
  assert.deepEqual(tokenize('  cat   a  '), ['cat', 'a'])
  assert.deepEqual(tokenize('search "foo bar"'), ['search', 'foo bar'])
  assert.deepEqual(tokenize("echo 'a b' c"), ['echo', 'a b', 'c'])
  assert.deepEqual(tokenize(''), [])
})

test('没有别名时原样返回', () => {
  const expand = createAliasExpander({})
  assert.deepEqual(expand(['ls', '-l']), ['ls', '-l'])
})

test('别名替换 head 并追加参数', () => {
  const expand = createAliasExpander({ ll: 'ls -l', b: 'cd blog' })
  assert.deepEqual(expand(['ll']), ['ls', '-l'])
  assert.deepEqual(expand(['ll', '/x']), ['ls', '-l', '/x'])
  assert.deepEqual(expand(['b']), ['cd', 'blog'])
  assert.deepEqual(expand(['b', 'sub']), ['cd', 'blog', 'sub'])
})

test('只展开一层，不递归', () => {
  const expand = createAliasExpander({ a: 'b', b: 'ls' })
  assert.deepEqual(expand(['a']), ['b'])
})

test('自引用不会死循环', () => {
  const expand = createAliasExpander({ a: 'a b' })
  assert.deepEqual(expand(['a']), ['a', 'b'])
})

test('参数里的别名不展开', () => {
  const expand = createAliasExpander({ a: 'echo' })
  assert.deepEqual(expand(['cat', 'a']), ['cat', 'a'])
})
