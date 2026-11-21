import assert from 'node:assert/strict'
import { test } from 'vitest'
import { stripFrontmatter } from '@/content/frontmatter.ts'

test('只去掉开头的 frontmatter 块', () => {
    assert.equal(stripFrontmatter('---\ntitle: x\n---\n正文'), '正文')
    assert.equal(stripFrontmatter('---\r\ntitle: x\r\n---\r\n正文'), '正文')
    assert.equal(stripFrontmatter('没有 frontmatter'), '没有 frontmatter')
    // 正文中间的 --- 是分隔线，不能动
    assert.equal(stripFrontmatter('前\n\n---\n\n后'), '前\n\n---\n\n后')
    // frontmatter 后面多出来的空行也去掉
    assert.equal(stripFrontmatter('---\ntitle: x\n---\n\n\n正文'), '正文')
    // 只有 frontmatter、没有正文
    assert.equal(stripFrontmatter('---\ntitle: x\n---\n'), '')
})
