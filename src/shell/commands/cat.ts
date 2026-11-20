import { completePath } from '../complete.ts'
import { resolveDoc } from '../doc.ts'
import { readDoc } from '../reader.ts'
import type { Command } from '../types.ts'

const cat: Command = {
    name: 'cat',
    description: '阅读文档',
    usage: 'cat <文件>',
    complete: (ctx, _argv, current) => completePath(ctx, current),
    async run(ctx, args) {
        const { doc, text } = await resolveDoc(ctx, cat, args)
        await readDoc(ctx, doc, text)
    },
}

export default cat
