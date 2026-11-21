import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { TuiDriver } from '@/term/driver.ts'
import { Canvas } from '@/tui/canvas.ts'

function fakeDriver(cols = 40, rows = 10) {
    const rowsDrawn: Array<{ row: number; text: string }> = []
    const writes: string[] = []
    const driver = {
        cols,
        rows,
        drawRow: (row: number, text: string) => void rowsDrawn.push({ row, text }),
        write: (data: string) => void writes.push(data),
    } as unknown as TuiDriver

    return { driver, rowsDrawn, writes }
}

test('put 把整行交给驱动', () => {
    const fake = fakeDriver()
    const canvas = new Canvas(fake.driver)
    canvas.put(2, 'hello')
    assert.deepEqual(fake.rowsDrawn, [{ row: 2, text: 'hello' }])
})

test('clear 用空字符串擦除', () => {
    const fake = fakeDriver()
    new Canvas(fake.driver).clear(3)
    assert.deepEqual(fake.rowsDrawn, [{ row: 3, text: '' }])
})

test('status 画在最后一行', () => {
    const fake = fakeDriver(40, 10)
    new Canvas(fake.driver).status({ left: 'x' })
    assert.equal(fake.rowsDrawn.at(-1)?.row, 9)
})

test('write 透传给驱动', () => {
    const fake = fakeDriver()
    new Canvas(fake.driver).write('raw')
    assert.deepEqual(fake.writes, ['raw'])
})
