import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocMeta } from '../../src/content/types.ts'
import { findTag, tagBuckets, tagDocsLines, tagsLines } from '../../src/shell/commands/tags.ts'
import { stripAnsi } from '../../src/term/width.ts'

const doc = (slug: string, tags: string[], date = ''): DocMeta => ({
  slug,
  path: `${slug}/index.md`,
  title: slug.split('/').pop() ?? slug,
  tags,
  chars: 0,
  kind: 'post',
  frontmatter: [],
  ...(date ? { date } : {}),
})

const docs: DocMeta[] = [
  doc('blog/a', ['nvm', 'fnm'], '2026-01-05'),
  doc('blog/b', ['nvm'], '2026-04-06'),
  doc('blog/c', ['Git', 'nvm'], '2026-03-01'),
]

test('按标签聚合，篇数多的在前', () => {
  const buckets = tagBuckets(docs)
  assert.deepEqual(
    buckets.map((bucket) => [bucket.tag, bucket.docs.length]),
    [
      ['nvm', 3],
      ['fnm', 1],
      ['Git', 1],
    ],
  )
})

test('findTag 忽略大小写', () => {
  const buckets = tagBuckets(docs)
  assert.equal(findTag(buckets, 'NVM')?.tag, 'nvm')
  assert.equal(findTag(buckets, 'nope'), undefined)
})

test('tags 列表列出标签和篇数', () => {
  const text = stripAnsi(tagsLines(docs, 60).join('\n'))
  assert.match(text, /3 个标签/)
  assert.match(text, /nvm/)
  assert.match(text, /█/)
})

test('标签下的文章按日期倒序，带标题差异时补在后面', () => {
  const bucket = findTag(tagBuckets(docs), 'nvm')!
  const lines = stripAnsi(tagDocsLines(bucket, 80).join('\n')).split('\n')

  assert.equal(lines[0], 'nvm')
  assert.equal(lines[1], '3 篇')

  const order = lines
    .filter((line) => line.includes('2026-'))
    .map((line) => line.trim().slice(0, 10))
  assert.deepEqual(order, ['2026-04-06', '2026-03-01', '2026-01-05'])
})
