/** 1786 → '1.8k'，832 → '832'，18000 → '18k' */
export function formatCount(count: number): string {
    if (count <= 0) return '-'
    if (count < 1000) return String(count)
    const k = count / 1000
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`
}

/** 45403 → '4.5 万字'，812 → '812 字' */
export function formatChars(count: number): string {
    if (count < 10000) return `${count} 字`
    return `${(count / 10000).toFixed(1)} 万字`
}
