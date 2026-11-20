export function selectedRows(
    rows: number[], selected: number[], anchor: number | null, clicked: number, event: MouseEvent
): number[] {
    const toggle = event.ctrlKey || event.metaKey;
    const from = anchor === null ? -1 : rows.indexOf(anchor);
    const to = rows.indexOf(clicked);
    if (event.shiftKey && from >= 0 && to >= 0) {
        const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
        return toggle ? [...new Set([...selected, ...range])] : range;
    }
    if (toggle) return selected.includes(clicked) ? selected.filter(id => id !== clicked) : [...selected, clicked];
    return [clicked];
}

export function isRowControl(event: MouseEvent): boolean {
    return event.target instanceof Element && !!event.target.closest('button, a, input, label, mat-checkbox');
}
