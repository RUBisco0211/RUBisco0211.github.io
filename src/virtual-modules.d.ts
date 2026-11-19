// 编译器产出的虚拟模块。声明成 ambient module（本文件不能有顶层 import，
// 否则会变成 module augmentation 而报错），所以类型用 import() 内联写。
declare module 'virtual:site-tree' {
  export const siteTree: import('./content/types.ts').SiteTree
}
