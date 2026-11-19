import { siteTree } from 'virtual:site-tree'
import { createContentStore } from './store.ts'

/**
 * 站点唯一的内容实例。
 *
 * 单独一个文件，是为了让 store.ts 保持纯函数、能在 node 里直接测 ——
 * 只有这里碰虚拟模块。
 */
export const content = createContentStore(siteTree)
export { createContentStore } from './store.ts'
export type { ContentStore } from './store.ts'
