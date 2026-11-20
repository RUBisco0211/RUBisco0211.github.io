import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorText, formatError } from '../../src/term/format.ts'
import { dim, red } from '../../src/term/ansi.ts'

test('errorText 取 Error 的 message，其余 String()', () => {
    assert.equal(errorText(new Error('坏了')), '坏了')
    assert.equal(errorText('坏了'), '坏了')
    assert.equal(errorText(42), '42')
})

test('formatError 是红字', () => {
    assert.equal(formatError(new Error('坏了')), red('坏了'))
})

test('formatError 的提示压暗跟在消息后面', () => {
    assert.equal(
        formatError('没有这个主题：x', '可选：a / b'),
        `${red('没有这个主题：x')}${dim('  可选：a / b')}`,
    )
})
