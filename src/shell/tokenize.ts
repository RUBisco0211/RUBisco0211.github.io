/** 拆词。只支持成对的引号，不做转义 —— 够用就行。 */
export function tokenize(line: string): string[] {
  const out: string[] = []
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line)) !== null) {
    out.push(match[1] ?? match[2] ?? match[3] ?? '')
  }
  return out
}
