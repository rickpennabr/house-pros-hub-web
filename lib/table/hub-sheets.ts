export type HubActiveCell = {
  rowIndex: number
  columnId: string
}

export type HubCellMove = {
  cell: HubActiveCell
  pageDelta: number
}

export type HubCellRange = {
  columnIds: string[]
  rowStart: number
  rowEnd: number
}

export type HubFindHit = {
  rowIndex: number
  columnId: string
}

const SKIP_COLUMN_IDS = new Set(['select', 'actions', 'batch_detect', 'reorder'])

const MOVE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Tab',
  'PageUp',
  'PageDown',
])

export function hubNavigableColumnIds(columnIds: readonly string[]): string[] {
  return columnIds.filter((id) => !SKIP_COLUMN_IDS.has(id))
}

export function isHubCellMoveKey(key: string): boolean {
  return MOVE_KEYS.has(key)
}

export function isHubEditableKeyTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(
    target.closest('[role="menu"], [role="dialog"], [role="listbox"], [data-hub-column-menu]')
  )
}

export function isHubInteractiveClickTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false
  return Boolean(
    target.closest('button, a, input, select, textarea, [role="checkbox"], [role="menuitem"]')
  )
}

export function hubActiveCellKey(cell: HubActiveCell): string {
  return `${cell.rowIndex}:${cell.columnId}`
}

export function defaultHubCellText(row: unknown, columnId: string): string {
  if (!row || typeof row !== 'object') return ''
  const value = (row as Record<string, unknown>)[columnId]
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => (item == null ? '' : String(item))).join(', ')
  }
  return ''
}

/**
 * Move the active cell like a spreadsheet. Tab wraps to the next row.
 * Arrows stay on the current page unless the move crosses a page edge.
 */
export function moveHubActiveCell(
  current: HubActiveCell,
  key: string,
  options: {
    columnIds: readonly string[]
    rowCount: number
    shiftKey?: boolean
    ctrlKey?: boolean
    hasPrevPage?: boolean
    hasNextPage?: boolean
    pageSize?: number
  }
): HubCellMove | null {
  const cols = hubNavigableColumnIds(options.columnIds)
  if (cols.length === 0 || options.rowCount <= 0) return null

  const colIndex = Math.max(0, cols.indexOf(current.columnId))
  const rowIndex = Math.min(Math.max(current.rowIndex, 0), options.rowCount - 1)
  const lastCol = cols.length - 1
  const lastRow = options.rowCount - 1
  const pageSize = Math.max(options.pageSize ?? options.rowCount, 1)

  const at = (nextRow: number, nextCol: number, pageDelta = 0): HubCellMove => ({
    cell: { rowIndex: nextRow, columnId: cols[nextCol]! },
    pageDelta,
  })

  switch (key) {
    case 'ArrowLeft':
      return colIndex <= 0 ? at(rowIndex, 0) : at(rowIndex, colIndex - 1)
    case 'ArrowRight':
      return colIndex >= lastCol ? at(rowIndex, lastCol) : at(rowIndex, colIndex + 1)
    case 'ArrowUp':
      if (rowIndex > 0) return at(rowIndex - 1, colIndex)
      if (options.hasPrevPage) return at(pageSize - 1, colIndex, -1)
      return at(0, colIndex)
    case 'ArrowDown':
      if (rowIndex < lastRow) return at(rowIndex + 1, colIndex)
      if (options.hasNextPage) return at(0, colIndex, 1)
      return at(lastRow, colIndex)
    case 'Home':
      return options.ctrlKey ? at(0, 0) : at(rowIndex, 0)
    case 'End':
      return options.ctrlKey ? at(lastRow, lastCol) : at(rowIndex, lastCol)
    case 'PageUp':
      if (options.hasPrevPage) return at(Math.min(rowIndex, pageSize - 1), colIndex, -1)
      return at(0, colIndex)
    case 'PageDown':
      if (options.hasNextPage) return at(0, colIndex, 1)
      return at(lastRow, colIndex)
    case 'Tab': {
      if (options.shiftKey) {
        if (colIndex > 0) return at(rowIndex, colIndex - 1)
        if (rowIndex > 0) return at(rowIndex - 1, lastCol)
        if (options.hasPrevPage) return at(pageSize - 1, lastCol, -1)
        return at(rowIndex, colIndex)
      }
      if (colIndex < lastCol) return at(rowIndex, colIndex + 1)
      if (rowIndex < lastRow) return at(rowIndex + 1, 0)
      if (options.hasNextPage) return at(0, 0, 1)
      return at(rowIndex, colIndex)
    }
    default:
      return null
  }
}

export function hubCellsInRange(
  start: HubActiveCell,
  end: HubActiveCell,
  columnIds: readonly string[]
): HubCellRange {
  const cols = hubNavigableColumnIds(columnIds)
  const c1 = Math.max(0, cols.indexOf(start.columnId))
  const c2 = Math.max(0, cols.indexOf(end.columnId))
  const [colStart, colEnd] = c1 <= c2 ? [c1, c2] : [c2, c1]
  const rowStart = Math.min(start.rowIndex, end.rowIndex)
  const rowEnd = Math.max(start.rowIndex, end.rowIndex)
  return { columnIds: cols.slice(colStart, colEnd + 1), rowStart, rowEnd }
}

export function isHubCellInRange(
  rowIndex: number,
  columnId: string,
  range: HubCellRange | null
): boolean {
  if (!range) return false
  return (
    rowIndex >= range.rowStart &&
    rowIndex <= range.rowEnd &&
    range.columnIds.includes(columnId)
  )
}

export function applyHubRowSelect(
  prev: ReadonlySet<string>,
  visibleIds: readonly string[],
  id: string,
  keys: { shiftKey: boolean; ctrlKey: boolean },
  anchorId: string | null
): { selected: Set<string>; anchorId: string } {
  const anchor = anchorId && visibleIds.includes(anchorId) ? anchorId : id

  if (keys.shiftKey) {
    const from = visibleIds.indexOf(anchor)
    const to = visibleIds.indexOf(id)
    if (from < 0 || to < 0) {
      const next = keys.ctrlKey ? new Set(prev) : new Set<string>()
      next.add(id)
      return { selected: next, anchorId: id }
    }
    const [start, end] = from < to ? [from, to] : [to, from]
    const range = visibleIds.slice(start, end + 1)
    if (keys.ctrlKey) {
      const next = new Set(prev)
      range.forEach((item) => next.add(item))
      return { selected: next, anchorId: anchor }
    }
    return { selected: new Set(range), anchorId: anchor }
  }

  if (keys.ctrlKey) {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { selected: next, anchorId: id }
  }

  return { selected: new Set([id]), anchorId: id }
}

export function findHubMatches<T>(
  rows: readonly T[],
  columns: readonly { id: string }[],
  query: string,
  textOf: (row: T, columnId: string) => string
): HubFindHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const dataColumns = columns.filter((column) => !SKIP_COLUMN_IDS.has(column.id))
  const hits: HubFindHit[] = []
  rows.forEach((row, rowIndex) => {
    dataColumns.forEach((column) => {
      if (textOf(row, column.id).toLowerCase().includes(needle)) {
        hits.push({ rowIndex, columnId: column.id })
      }
    })
  })
  return hits
}

export function nextHubFindIndex(hitCount: number, current: number, direction: 1 | -1): number {
  if (hitCount <= 0) return 0
  return (current + direction + hitCount * 2) % hitCount
}

function escapeDelimited(text: string, delimiter: '\t' | ','): string {
  const pattern = delimiter === ',' ? /[",\n\r]/ : /[\t\n\r]/
  if (!pattern.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

export function hubRangeText<T>(
  rows: readonly T[],
  columns: readonly { id: string }[],
  range: HubCellRange,
  textOf: (row: T, columnId: string) => string,
  delimiter: '\t' | ',' = '\t'
): string {
  const lines: string[] = []
  for (let rowIndex = range.rowStart; rowIndex <= range.rowEnd; rowIndex++) {
    const row = rows[rowIndex]
    if (!row) continue
    lines.push(
      range.columnIds
        .map((columnId) => escapeDelimited(textOf(row, columnId), delimiter))
        .join(delimiter)
    )
  }
  return lines.join('\n')
}

export function hubRowsText<T>(
  rows: readonly T[],
  columnIds: readonly string[],
  textOf: (row: T, columnId: string) => string,
  delimiter: '\t' | ',' = '\t',
  headers?: readonly string[]
): string {
  const lines: string[] = []
  if (headers && headers.length > 0) {
    lines.push(headers.map((header) => escapeDelimited(header, delimiter)).join(delimiter))
  }
  rows.forEach((row) => {
    lines.push(columnIds.map((columnId) => escapeDelimited(textOf(row, columnId), delimiter)).join(delimiter))
  })
  return lines.join('\n')
}

export function compareHubCellText(a: string, b: string): number {
  const aNum = a.trim() === '' ? NaN : Number(a)
  const bNum = b.trim() === '' ? NaN : Number(b)
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
