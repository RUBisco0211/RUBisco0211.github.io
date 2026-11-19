/**
 * 带前缀的命令历史。
 *
 * xterm-readline 的 History 把数据写进裸 key `"history"`，同源下太容易撞。
 * 它的两个存储方法可以被覆盖，所以继承下来只换掉读写这两处，
 * 其余（去重、上限、游标）仍然是库自己的逻辑。
 */

import { History } from 'xterm-readline/lib/history.js'
import { readStored, takeLegacy, writeStored } from '../storage.ts'

const NAME = 'history'
/** 老版本 xterm-readline 用的裸 key，第一次跑时迁移过来 */
const LEGACY_KEY = 'history'

export class SiteHistory extends History {
    override saveToLocalStorage(): void {
        writeStored(NAME, JSON.stringify(this.entries))
    }

    override restoreFromLocalStorage(): void {
        const raw = readStored(NAME) ?? takeLegacy(LEGACY_KEY)
        if (raw === null) return

        try {
            const parsed: unknown = JSON.parse(raw)
            if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
                this.entries = []
                writeStored(NAME, '[]')
                return
            }
            this.entries = parsed
        } catch {
            this.entries = []
            writeStored(NAME, '[]')
        }
    }
}
