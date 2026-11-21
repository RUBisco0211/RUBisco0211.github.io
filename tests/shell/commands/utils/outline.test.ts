import assert from 'node:assert/strict'
import { test } from 'vitest'
import { locateTitles } from '@/shell/commands/utils/outline.ts'

test('locateTitles 把标题映射到行号，重复标题各自对上', () => {
    const lines = ['前言', '安装工具', '正文', '配置 shell', '安装工具']
    assert.deepEqual(locateTitles(lines, ['安装工具', '配置 shell']), [1, 3])
    // 第二次出现同一个标题时不会还指到第一处
    assert.deepEqual(locateTitles(lines, ['安装工具', '安装工具']), [1, 4])
})

test('找不到的标题返回 -1', () => {
    assert.deepEqual(locateTitles(['a'], ['没有这个']), [-1])
})

test('locateTitles 忽略行内 ANSI 和大小写', () => {
    const lines = ['\x1b[1m\x1b[36m安装工具\x1b[39m\x1b[22m']
    assert.deepEqual(locateTitles(lines, ['安装工具']), [0])
})
