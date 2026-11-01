'use client';

import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronDown,
  ChevronUp,
  Copy,
  Pin,
  PinOff,
  Search,
  X,
} from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import {
  applyHubRowSelect,
  compareHubCellText,
  defaultHubCellText,
  findHubMatches,
  hubActiveCellKey,
  hubCellsInRange,
  hubNavigableColumnIds,
  hubRangeText,
  hubRowsText,
  isHubCellInRange,
  isHubCellMoveKey,
  isHubEditableKeyTarget,
  isHubInteractiveClickTarget,
  moveHubActiveCell,
  nextHubFindIndex,
  type HubActiveCell,
} from '@/lib/table/hub-sheets';

const ACTIONS_COLUMN_WIDTH = 72;
const BULK_SELECT_COLUMN_WIDTH = 44;
const MIN_COLUMN_WIDTH = 60;
const DEFAULT_COLUMN_WIDTH = 160;

export interface AdminDataTableColumn<T> {
  id: string;
  label: string;
  /** Server sort key. Header menu calls onSort with this key. */
  sortKey?: string;
  /** If false, column is not resizable (e.g. actions). Default true for data columns. */
  resizable?: boolean;
  /** Starting width in pixels. */
  width?: number;
  /** Let the cell wrap instead of clipping to one line. */
  wrap?: boolean;
}

export interface AdminDataTableBulkActions<T> {
  onDelete?: (ids: string[]) => void;
  onCopyAsJson?: (rows: T[]) => void;
  /** Shown only when exactly one row is selected */
  onEdit?: (row: T) => void;
  labelDelete?: string;
  labelCopyAsJson?: string;
  labelEdit?: string;
}

export type HubColumnValueFilter = {
  query: string;
  /** When set, the cell text must be one of these values. */
  values: string[] | null;
};

export interface AdminDataTableProps<T> {
  columns: AdminDataTableColumn<T>[];
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  searchInput?: string;
  onSearchInput?: (value: string) => void;
  onSearchSubmit?: (e: React.FormEvent) => void;
  searchPlaceholder?: string;
  /**
   * Search, sort, column filters, and pagination run on `data` in the browser.
   * Use this for lists that are already fully loaded.
   */
  clientSide?: boolean;
  /** Plain text for find, copy, filter, and client sort. Falls back to a same-named field. */
  getCellText?: (row: T, columnId: string) => string;
  /** localStorage key for column order and frozen columns. */
  columnOrderKey?: string;
  /** File name used by Export CSV. */
  exportName?: string;
  isLoading: boolean;
  isRefetching?: boolean;
  hasLoadedOnce?: boolean;
  error: string | null;
  getRowId: (row: T) => string;
  renderCell: (row: T, columnId: string) => React.ReactNode;
  /** Second click, double-click, or Enter on a selected cell. */
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => React.ReactNode;
  bulkActions?: AdminDataTableBulkActions<T>;
  emptyMessage?: string;
  itemLabel?: string;
  primaryColumnId?: string;
  resizableColumnIds?: readonly string[];
  minColumnWidth?: number;
  tableLayoutMinWidth?: number;
}

function downloadTextFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminDataTable<T>({
  columns,
  data,
  total,
  page = 1,
  pageSize = 25,
  onPageChange,
  sortBy = '',
  sortDir = 'asc',
  onSort,
  searchInput = '',
  onSearchInput,
  onSearchSubmit,
  searchPlaceholder = 'Search…',
  clientSide = false,
  getCellText,
  columnOrderKey,
  exportName = 'export',
  isLoading,
  isRefetching = false,
  hasLoadedOnce = true,
  error,
  getRowId,
  renderCell,
  onRowClick,
  renderActions,
  bulkActions,
  emptyMessage = 'No items found.',
  itemLabel = 'items',
  primaryColumnId,
  resizableColumnIds,
  minColumnWidth = MIN_COLUMN_WIDTH,
  tableLayoutMinWidth = 600,
}: AdminDataTableProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const rowAnchorRef = useRef<string | null>(null);
  const keepCellRef = useRef(false);
  const pageRef = useRef(1);

  const [columnWidths, setColumnWidths] = useState<Partial<Record<string, number>>>({});
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const [frozenUntilId, setFrozenUntilId] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<HubActiveCell | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<HubActiveCell | null>(null);
  const [columnMenu, setColumnMenu] = useState<{ columnId: string; x: number; y: number } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findHitIndex, setFindHitIndex] = useState(0);
  const [columnFilters, setColumnFilters] = useState<Record<string, HubColumnValueFilter>>({});
  const [filterDraft, setFilterDraft] = useState<HubColumnValueFilter>({ query: '', values: null });
  const [internalSearch, setInternalSearch] = useState('');
  const [internalPage, setInternalPage] = useState(1);
  const [internalSort, setInternalSort] = useState<{ columnId: string; dir: 'asc' | 'desc' } | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const textOf = useCallback(
    (row: T, columnId: string) => {
      if (getCellText) return getCellText(row, columnId);
      return defaultHubCellText(row, columnId);
    },
    [getCellText]
  );

  const orderedDataColumns = useMemo(() => {
    const dataCols = columns.filter((column) => column.id !== 'actions');
    if (!columnOrder || columnOrder.length === 0) return dataCols;
    const byId = new Map(dataCols.map((column) => [column.id, column]));
    const ordered = columnOrder
      .map((id) => byId.get(id))
      .filter((column): column is AdminDataTableColumn<T> => Boolean(column));
    const rest = dataCols.filter((column) => !columnOrder.includes(column.id));
    return [...ordered, ...rest];
  }, [columnOrder, columns]);

  const displayColumns = useMemo(() => {
    const actions = columns.find((column) => column.id === 'actions');
    const select = bulkActions
      ? [{ id: 'select', label: '', resizable: false } as AdminDataTableColumn<T>]
      : [];
    return [...select, ...orderedDataColumns, ...(actions ? [actions] : [])];
  }, [bulkActions, columns, orderedDataColumns]);

  const navigableColumns = useMemo(
    () => orderedDataColumns.filter((column) => hubNavigableColumnIds([column.id]).length > 0),
    [orderedDataColumns]
  );

  const baseRows = useMemo(() => {
    const query = clientSide ? internalSearch.trim().toLowerCase() : '';
    const searched =
      query.length > 0
        ? data.filter((row) =>
            navigableColumns.some((column) => textOf(row, column.id).toLowerCase().includes(query))
          )
        : data;
    if (!internalSort) return searched;
    const { columnId, dir } = internalSort;
    const sign = dir === 'asc' ? 1 : -1;
    return [...searched].sort(
      (a, b) => sign * compareHubCellText(textOf(a, columnId), textOf(b, columnId))
    );
  }, [clientSide, data, internalSearch, internalSort, navigableColumns, textOf]);

  const filteredRows = useMemo(() => {
    const active = Object.entries(columnFilters).filter(([, filter]) => {
      if (!filter) return false;
      if (filter.query.trim()) return true;
      return Boolean(filter.values && filter.values.length > 0);
    });
    if (active.length === 0) return baseRows;
    return baseRows.filter((row) =>
      active.every(([columnId, filter]) => {
        const text = textOf(row, columnId);
        if (filter.query.trim() && !text.toLowerCase().includes(filter.query.trim().toLowerCase())) {
          return false;
        }
        if (filter.values && !filter.values.includes(text)) return false;
        return true;
      })
    );
  }, [baseRows, columnFilters, textOf]);

  const currentPage = clientSide ? internalPage : page;
  pageRef.current = currentPage;
  const pagedRows = useMemo(() => {
    if (!clientSide) return filteredRows;
    const start = (internalPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [clientSide, filteredRows, internalPage, pageSize]);

  const visibleTotal = clientSide ? filteredRows.length : total;
  const totalPages = Math.max(1, Math.ceil(visibleTotal / pageSize));
  const firstDataColumnId = navigableColumns[0]?.id;
  const primaryId = primaryColumnId ?? firstDataColumnId;

  useEffect(() => {
    if (!clientSide) return;
    const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (internalPage > pages) setInternalPage(pages);
  }, [clientSide, filteredRows.length, internalPage, pageSize]);

  useEffect(() => {
    if (!columnOrderKey) return;
    try {
      const storedOrder = localStorage.getItem(columnOrderKey);
      if (storedOrder) {
        const parsed = JSON.parse(storedOrder) as unknown;
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
          setColumnOrder(parsed);
        }
      }
      setFrozenUntilId(localStorage.getItem(`${columnOrderKey}:frozen`));
    } catch {
      // Ignore unreadable saved layout.
    }
  }, [columnOrderKey]);

  useEffect(() => {
    if (!columnOrderKey || !columnOrder) return;
    localStorage.setItem(columnOrderKey, JSON.stringify(columnOrder));
  }, [columnOrder, columnOrderKey]);

  const visibleIdsKey = pagedRows.map((row) => getRowId(row)).join('\n');
  useEffect(() => {
    setSelectedIds(new Set());
    if (keepCellRef.current) {
      keepCellRef.current = false;
      return;
    }
    setActiveCell(null);
    setRangeAnchor(null);
  }, [visibleIdsKey]);

  const allOnPageSelected = pagedRows.length > 0 && pagedRows.every((row) => selectedIds.has(getRowId(row)));
  const someOnPageSelected = pagedRows.some((row) => selectedIds.has(getRowId(row)));

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  const selectedRows = useMemo(
    () => pagedRows.filter((row) => selectedIds.has(getRowId(row))),
    [getRowId, pagedRows, selectedIds]
  );

  const widthOf = useCallback(
    (columnId: string) => {
      if (columnId === 'actions') return ACTIONS_COLUMN_WIDTH;
      if (columnId === 'select') return BULK_SELECT_COLUMN_WIDTH;
      if (columnWidths[columnId]) return columnWidths[columnId]!;
      return columns.find((column) => column.id === columnId)?.width ?? DEFAULT_COLUMN_WIDTH;
    },
    [columnWidths, columns]
  );

  const freezeOffsets = useMemo(() => {
    if (!frozenUntilId) return {} as Record<string, number>;
    const offsets: Record<string, number> = {};
    let left = 0;
    for (const column of displayColumns) {
      offsets[column.id] = left;
      left += widthOf(column.id);
      if (column.id === frozenUntilId) return offsets;
    }
    return {} as Record<string, number>;
  }, [displayColumns, frozenUntilId, widthOf]);

  const canResize = (colId: string) => {
    if (colId === 'actions' || colId === 'select') return false;
    if (resizableColumnIds) return resizableColumnIds.includes(colId);
    const column = columns.find((item) => item.id === colId);
    return column?.resizable !== false;
  };

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(pagedRows.map((row) => getRowId(row))));
    const first = pagedRows[0];
    rowAnchorRef.current = first ? getRowId(first) : null;
  };

  const toggleRow = (row: T) => {
    const id = getRowId(row);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    rowAnchorRef.current = id;
  };

  const applyRowKeys = useCallback(
    (id: string, keys: { shiftKey: boolean; ctrlKey: boolean }) => {
      const visibleIds = pagedRows.map((row) => getRowId(row));
      const next = applyHubRowSelect(selectedIds, visibleIds, id, keys, rowAnchorRef.current);
      rowAnchorRef.current = next.anchorId;
      setSelectedIds(next.selected);
    },
    [getRowId, pagedRows, selectedIds]
  );

  const selectCell = useCallback((rowIndex: number, columnId: string, extend: boolean) => {
    const cell = { rowIndex, columnId };
    setActiveCell(cell);
    setSelectedColumnId(null);
    setRangeAnchor((prev) => (extend ? prev ?? cell : cell));
  }, []);

  const selectionRange = activeCell
    ? hubCellsInRange(rangeAnchor || activeCell, activeCell, navigableColumns.map((column) => column.id))
    : null;

  const findRows = clientSide ? filteredRows : pagedRows;
  const findHits = useMemo(
    () => findHubMatches(findRows, navigableColumns, findQuery, textOf),
    [findQuery, findRows, navigableColumns, textOf]
  );

  const jumpToFindHit = useCallback(
    (hit: { rowIndex: number; columnId: string } | undefined) => {
      if (!hit) return;
      if (!clientSide) {
        selectCell(hit.rowIndex, hit.columnId, false);
        return;
      }
      const nextPage = Math.floor(hit.rowIndex / pageSize) + 1;
      if (nextPage !== pageRef.current) keepCellRef.current = true;
      setInternalPage(nextPage);
      selectCell(hit.rowIndex % pageSize, hit.columnId, false);
    },
    [clientSide, pageSize, selectCell]
  );

  const moveFind = useCallback(
    (direction: 1 | -1) => {
      if (findHits.length === 0) return;
      const nextIndex = nextHubFindIndex(findHits.length, findHitIndex, direction);
      setFindHitIndex(nextIndex);
      jumpToFindHit(findHits[nextIndex]);
    },
    [findHitIndex, findHits, jumpToFindHit]
  );

  const openFind = useCallback(() => {
    setFindOpen(true);
    window.setTimeout(() => findInputRef.current?.focus(), 0);
  }, []);

  const copyText = useCallback(async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 1500);
    } catch {
      // Clipboard permission can fail silently; the sheet stays usable.
    }
  }, []);

  const copySelection = useCallback(async () => {
    const navIds = navigableColumns.map((column) => column.id);
    if (activeCell) {
      const range = hubCellsInRange(rangeAnchor || activeCell, activeCell, navIds);
      await copyText(hubRangeText(pagedRows, navigableColumns, range, textOf), 'Copied');
      return;
    }
    if (selectedColumnId) {
      const lines = pagedRows.map((row) => textOf(row, selectedColumnId));
      await copyText(lines.join('\n'), 'Copied');
      return;
    }
    if (selectedRows.length > 0) {
      await copyText(hubRowsText(selectedRows, navIds, textOf), 'Copied');
    }
  }, [activeCell, copyText, navigableColumns, pagedRows, rangeAnchor, selectedColumnId, selectedRows, textOf]);

  const exportCsv = () => {
    const nav = navigableColumns;
    const headers = nav.map((column) => column.label);
    const ids = nav.map((column) => column.id);
    const rows = selectedRows.length > 0 ? selectedRows : selectedColumnId ? pagedRows : pagedRows;
    const columnIds = selectedColumnId && selectedRows.length === 0 ? [selectedColumnId] : ids;
    const headerRow =
      selectedColumnId && selectedRows.length === 0
        ? [nav.find((column) => column.id === selectedColumnId)?.label ?? selectedColumnId]
        : headers;
    const csv = hubRowsText(rows, columnIds, textOf, ',', headerRow);
    downloadTextFile(`${exportName}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const openActiveRow = useCallback(() => {
    if (!activeCell) return;
    const row = pagedRows[activeCell.rowIndex];
    if (row) onRowClick?.(row);
  }, [activeCell, onRowClick, pagedRows]);

  const persistFreeze = (columnId: string | null) => {
    setFrozenUntilId(columnId);
    setColumnMenu(null);
    if (!columnOrderKey) return;
    if (columnId) localStorage.setItem(`${columnOrderKey}:frozen`, columnId);
    else localStorage.removeItem(`${columnOrderKey}:frozen`);
  };

  const activeSortColumnId = clientSide
    ? internalSort?.columnId ?? null
    : navigableColumns.find((column) => column.sortKey === sortBy)?.id ?? null;
  const activeSortDir = clientSide ? internalSort?.dir ?? 'asc' : sortDir;

  const sortColumn = (column: AdminDataTableColumn<T>, dir: 'asc' | 'desc') => {
    if (clientSide || !column.sortKey) {
      setInternalSort({ columnId: column.id, dir });
      if (clientSide) setInternalPage(1);
    }
    if (!clientSide && column.sortKey) {
      setInternalSort(null);
      onSort?.(column.sortKey, dir);
    }
    setColumnMenu(null);
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(minColumnWidth, resizing.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.columnId]: newWidth }));
    };
    const onUp = () => setResizing(null);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [minColumnWidth, resizing]);

  const stateRef = useRef({
    activeCell,
    applyRowKeys,
    columnMenu,
    copySelection,
    currentPage,
    findHits,
    findOpen,
    moveFind,
    navigableColumns,
    openActiveRow,
    openFind,
    pagedRows,
    pageSize,
    rangeAnchor,
    selectCell,
    selectedIds,
    totalPages,
  });
  stateRef.current = {
    activeCell,
    applyRowKeys,
    columnMenu,
    copySelection,
    currentPage,
    findHits,
    findOpen,
    moveFind,
    navigableColumns,
    openActiveRow,
    openFind,
    pagedRows,
    pageSize,
    rangeAnchor,
    selectCell,
    selectedIds,
    totalPages,
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = stateRef.current;
      const target = event.target;
      const inSheet = target instanceof Element && Boolean(wrapperRef.current?.contains(target));
      const inDialog = target instanceof Element && Boolean(target.closest('[role="dialog"]'));
      const inFind = target instanceof Element && Boolean(target.closest('[data-hub-find]'));
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && key === 'f' && !inDialog && (inSheet || state.findOpen || Boolean(state.activeCell))) {
        event.preventDefault();
        state.openFind();
        return;
      }
      if (inFind || isHubEditableKeyTarget(target)) return;
      if (!inSheet && !state.activeCell && !state.findOpen && !state.columnMenu) return;

      if (event.key === 'Escape') {
        if (state.findOpen) {
          setFindOpen(false);
          setFindQuery('');
          return;
        }
        setSelectedColumnId(null);
        setColumnMenu(null);
        setActiveCell(null);
        setRangeAnchor(null);
        return;
      }
      if (state.columnMenu) return;

      if (mod && key === 'a' && inSheet) {
        event.preventDefault();
        if (bulkActions) {
          setSelectedIds(new Set(state.pagedRows.map((row) => getRowId(row))));
        } else if (state.pagedRows.length && state.navigableColumns[0]) {
          const last = state.navigableColumns[state.navigableColumns.length - 1];
          setRangeAnchor({ rowIndex: 0, columnId: state.navigableColumns[0].id });
          setActiveCell({
            rowIndex: state.pagedRows.length - 1,
            columnId: last?.id ?? state.navigableColumns[0].id,
          });
        }
        return;
      }

      if (mod && key === 'c' && (inSheet || state.activeCell)) {
        event.preventDefault();
        void state.copySelection();
        return;
      }

      if (!state.activeCell) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        state.openActiveRow();
        return;
      }
      if (event.key === 'F3' || (mod && key === 'g')) {
        event.preventDefault();
        if (!state.findOpen) state.openFind();
        else state.moveFind(event.shiftKey ? -1 : 1);
        return;
      }
      if (!isHubCellMoveKey(event.key)) return;
      const next = moveHubActiveCell(state.activeCell, event.key, {
        columnIds: state.navigableColumns.map((column) => column.id),
        rowCount: state.pagedRows.length,
        shiftKey: event.shiftKey,
        ctrlKey: mod,
        hasPrevPage: state.currentPage > 1,
        hasNextPage: state.currentPage < state.totalPages,
        pageSize: state.pageSize,
      });
      if (!next) return;
      event.preventDefault();
      if (next.pageDelta) {
        keepCellRef.current = true;
        if (clientSide) setInternalPage((prev) => prev + next.pageDelta);
        else onPageChange?.(state.currentPage + next.pageDelta);
      }
      if (event.shiftKey) {
        setActiveCell(next.cell);
        setRangeAnchor((prev) => prev || state.activeCell);
        if (bulkActions && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          const to = state.pagedRows[next.cell.rowIndex];
          if (to) state.applyRowKeys(getRowId(to), { shiftKey: true, ctrlKey: false });
        }
      } else {
        setRangeAnchor(next.cell);
        setActiveCell(next.cell);
      }
    };

    const onPointer = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (wrapperRef.current?.contains(target)) return;
      if (target.closest('[data-hub-column-menu], [data-hub-find]')) return;
      setSelectedColumnId(null);
      setActiveCell(null);
      setRangeAnchor(null);
      setColumnMenu(null);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [bulkActions, clientSide, getRowId, onPageChange]);

  useLayoutEffect(() => {
    if (!activeCell) return;
    const el = wrapperRef.current?.querySelector<HTMLElement>(
      `[data-hub-cell="${hubActiveCellKey(activeCell)}"]`
    );
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (findOpen) return;
    if (document.querySelector('[role="dialog"]')) return;
    const focused = document.activeElement;
    const gridHasFocus =
      focused instanceof HTMLElement &&
      (focused === document.body ||
        focused === document.documentElement ||
        wrapperRef.current?.contains(focused));
    if (gridHasFocus && focused !== el && !isHubEditableKeyTarget(focused)) {
      el.focus({ preventScroll: true });
    }
  }, [activeCell, findOpen]);

  useEffect(() => {
    if (!findOpen) return;
    setFindHitIndex(0);
    jumpToFindHit(findHits[0]);
    // Jump to the first match when the query changes, not when the callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findHits, findOpen]);

  const menuColumn = columnMenu
    ? navigableColumns.find((column) => column.id === columnMenu.columnId) ?? null
    : null;

  const uniqueValues = useMemo(() => {
    if (!menuColumn) return [];
    const values = new Set<string>();
    baseRows.forEach((row) => values.add(textOf(row, menuColumn.id)));
    return [...values].sort((a, b) => compareHubCellText(a, b));
  }, [baseRows, menuColumn, textOf]);

  const openColumnMenu = (columnId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const applied = columnFilters[columnId] ?? { query: '', values: null };
    setFilterDraft({ query: applied.query, values: applied.values ? [...applied.values] : null });
    setColumnMenu({ columnId, x: Math.min(rect.left, window.innerWidth - 280), y: rect.bottom + 4 });
  };

  const reorderColumn = (fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return;
    setColumnOrder((prev) => {
      const ids = [...(prev ?? navigableColumns.map((column) => column.id))].filter((id) => id !== fromId);
      const index = ids.indexOf(toId);
      if (index < 0) ids.push(fromId);
      else ids.splice(index, 0, fromId);
      return ids;
    });
  };

  const showBulkBar = selectedIds.size > 0 || Boolean(selectedColumnId);
  const tableMinWidth = Math.max(
    tableLayoutMinWidth,
    displayColumns.reduce((sum, column) => sum + widthOf(column.id), 0)
  );

  const handleSearchChange = (value: string) => {
    if (clientSide) {
      setInternalSearch(value);
      setInternalPage(1);
    }
    onSearchInput?.(value);
  };

  const handlePageChange = (nextPage: number) => {
    if (clientSide) setInternalPage(nextPage);
    else onPageChange?.(nextPage);
  };

  return (
    <div ref={wrapperRef} className="flex flex-col">
      <form
        onSubmit={(event) => {
          if (clientSide) {
            event.preventDefault();
            setInternalPage(1);
            return;
          }
          onSearchSubmit?.(event);
        }}
        className="flex gap-2 pb-2 max-w-md"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={clientSide ? internalSearch : searchInput}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full h-10 pl-10 border-2 border-black rounded-lg text-sm bg-white text-black placeholder:text-gray-500 focus:outline-none ${
              clientSide && internalSearch ? 'pr-10' : 'pr-3'
            }`}
          />
          {clientSide && internalSearch ? (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
        {clientSide ? null : (
          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Search
          </button>
        )}
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      {showBulkBar && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-black bg-neutral-50 px-3 py-2 mb-2">
          <span className="text-sm font-medium text-black">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `${navigableColumns.find((column) => column.id === selectedColumnId)?.label ?? 'Column'} column`}
          </span>
          {copiedLabel ? <span className="text-xs font-medium text-gray-600">{copiedLabel}</span> : null}
          <button
            type="button"
            onClick={() => void copySelection()}
            className="text-sm font-medium text-black cursor-pointer px-2 py-1 rounded-md hover:bg-neutral-200 border-2 border-black"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="text-sm font-medium text-black cursor-pointer px-2 py-1 rounded-md hover:bg-neutral-200 border-2 border-black"
          >
            Export CSV
          </button>
          {bulkActions?.onCopyAsJson && selectedRows.length > 0 && (
            <button
              type="button"
              onClick={() => bulkActions.onCopyAsJson?.(selectedRows)}
              className="text-sm font-medium text-black cursor-pointer px-2 py-1 rounded-md hover:bg-neutral-200 border-2 border-black"
            >
              {bulkActions.labelCopyAsJson ?? 'Copy as JSON'}
            </button>
          )}
          {bulkActions?.onEdit && selectedRows.length === 1 && (
            <button
              type="button"
              onClick={() => {
                const row = selectedRows[0];
                if (row) bulkActions.onEdit?.(row);
              }}
              className="text-sm font-medium text-black cursor-pointer px-2 py-1 rounded-md hover:bg-neutral-200 border-2 border-black"
            >
              {bulkActions.labelEdit ?? 'Edit'}
            </button>
          )}
          {bulkActions?.onDelete && selectedRows.length > 0 && (
            <button
              type="button"
              onClick={() => bulkActions.onDelete?.(selectedRows.map((row) => getRowId(row)))}
              className="text-sm font-medium text-white cursor-pointer px-2 py-1 rounded-md bg-red-600 hover:bg-red-700 border-2 border-red-600"
            >
              {bulkActions.labelDelete ?? 'Delete'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedIds(new Set());
              setSelectedColumnId(null);
              setActiveCell(null);
              setRangeAnchor(null);
            }}
            className="text-sm text-gray-700 cursor-pointer px-2 py-1 rounded-md hover:bg-neutral-200 border-2 border-gray-400"
          >
            Clear
          </button>
        </div>
      )}

      <div className="relative border-2 border-black rounded-lg overflow-hidden bg-white">
        {findOpen ? (
          <div
            data-hub-find=""
            className="absolute right-2 top-2 z-40 flex items-center gap-1 rounded-lg border-2 border-black bg-white px-2 py-1 shadow-md"
          >
            <Search className="h-4 w-4 shrink-0 text-black" />
            <input
              ref={findInputRef}
              value={findQuery}
              onChange={(event) => setFindQuery(event.target.value)}
              placeholder="Find"
              aria-label="Find"
              className="w-36 border-0 bg-transparent text-sm text-black outline-none sm:w-44"
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'F3') {
                  event.preventDefault();
                  event.stopPropagation();
                  moveFind(event.shiftKey ? -1 : 1);
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setFindOpen(false);
                  setFindQuery('');
                }
              }}
            />
            <span className="whitespace-nowrap text-xs font-medium text-black">
              {findQuery.trim() ? (findHits.length ? `${Math.min(findHitIndex + 1, findHits.length)}/${findHits.length}` : '0/0') : ''}
            </span>
            <button type="button" className="p-1 rounded hover:bg-neutral-100 cursor-pointer" aria-label="Previous match" onClick={() => moveFind(-1)}>
              <ChevronUp className="h-4 w-4" />
            </button>
            <button type="button" className="p-1 rounded hover:bg-neutral-100 cursor-pointer" aria-label="Next match" onClick={() => moveFind(1)}>
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1 rounded hover:bg-neutral-100 cursor-pointer"
              aria-label="Close find"
              onClick={() => {
                setFindOpen(false);
                setFindQuery('');
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {isLoading && !hasLoadedOnce ? (
          <div className="p-12 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto relative">
            {isRefetching && (
              <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center" aria-hidden>
                <span className="text-sm text-gray-500">Updating…</span>
              </div>
            )}
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: tableMinWidth }}>
              <colgroup>
                {displayColumns.map((col) => (
                  <col key={col.id} style={{ width: widthOf(col.id), minWidth: widthOf(col.id) }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b-2 border-black bg-black text-white">
                  {displayColumns.map((col) => {
                    const selected = selectedColumnId === col.id;
                    const frozenLeft = freezeOffsets[col.id];
                    const isLastFrozen = col.id === frozenUntilId;
                    const headerSticky =
                      frozenLeft != null
                        ? {
                            position: 'sticky' as const,
                            left: frozenLeft,
                            zIndex: 6,
                            background: selected ? '#fff' : '#000',
                            boxShadow: isLastFrozen ? '4px 0 8px rgba(0,0,0,0.15)' : undefined,
                          }
                        : undefined;
                    if (col.id === 'select') {
                      return (
                        <th
                          key={col.id}
                          className="py-2.5 text-center bg-black border-r border-white"
                          style={{ ...headerSticky, paddingLeft: 8, paddingRight: 8 }}
                        >
                          <input
                            type="checkbox"
                            ref={selectAllRef}
                            checked={allOnPageSelected}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer"
                            aria-label="Select all on page"
                          />
                        </th>
                      );
                    }
                    if (col.id === 'actions') {
                      return (
                        <th
                          key={col.id}
                          className="sticky right-0 z-10 py-2.5 text-center bg-black border-l-2 border-white shadow-[-4px_0_8px_rgba(0,0,0,0.15)]"
                          style={{ paddingLeft: 10, paddingRight: 10 }}
                        >
                          <span className="font-semibold text-white whitespace-nowrap">Actions</span>
                        </th>
                      );
                    }
                    const sorted = activeSortColumnId === col.id;
                    const filtered = Boolean(columnFilters[col.id]?.query || columnFilters[col.id]?.values?.length);
                    return (
                      <th
                        key={col.id}
                        className={`relative px-3 py-2.5 text-left border-r border-white select-none ${
                          selected ? 'bg-white text-black' : 'bg-black text-white'
                        } ${dragOverId === col.id ? 'outline outline-2 outline-white' : ''}`}
                        style={headerSticky}
                        onContextMenu={(event) => openColumnMenu(col.id, event)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOverId(col.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          reorderColumn(event.dataTransfer.getData('text/plain'), col.id);
                          setDragOverId(null);
                        }}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <span
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData('text/plain', col.id);
                              event.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDragOverId(null)}
                            onClick={() => {
                              setSelectedColumnId((current) => (current === col.id ? null : col.id));
                              setActiveCell(null);
                              setRangeAnchor(null);
                            }}
                            className={`font-semibold truncate cursor-pointer ${selected ? 'text-black' : 'text-white'}`}
                            title="Drag to reorder. Click to select the column."
                          >
                            {col.label}
                            {sorted ? (
                              <span className={`ml-1 text-[10px] font-bold ${selected ? 'text-black' : 'text-white'}`}>
                                {activeSortDir === 'asc' ? 'A→Z' : 'Z→A'}
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => openColumnMenu(col.id, event)}
                            className={`p-0.5 rounded cursor-pointer ${selected ? 'hover:bg-black/10 text-black' : 'hover:bg-white/20 text-white'}`}
                            aria-label={`${col.label} column menu`}
                          >
                            <ChevronDown className="w-4 h-4 shrink-0" />
                          </button>
                        </div>
                        {filtered ? (
                          <span
                            className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full ${selected ? 'bg-black' : 'bg-white'}`}
                            aria-hidden
                          />
                        ) : null}
                        {canResize(col.id) && (
                          <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize ${col.label} column`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const th = (event.target as HTMLElement).closest('th');
                              const startWidth = th ? th.getBoundingClientRect().width : widthOf(col.id);
                              setResizing({ columnId: col.id, startX: event.clientX, startWidth });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize touch-none z-20 hover:bg-white/30"
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={displayColumns.length} className="px-4 py-12 text-center text-gray-500 text-sm">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row, rowIndex) => {
                    const rowId = getRowId(row);
                    const rowChecked = selectedIds.has(rowId);
                    return (
                      <tr key={rowId} className={`border-b border-gray-200 ${rowChecked ? 'bg-neutral-100' : ''}`}>
                        {displayColumns.map((col) => {
                          const frozenLeft = freezeOffsets[col.id];
                          const isLastFrozen = col.id === frozenUntilId;
                          if (col.id === 'select') {
                            return (
                              <td
                                key={col.id}
                                className="py-2 text-center border-r border-gray-200 bg-white"
                                style={{
                                  paddingLeft: 8,
                                  paddingRight: 8,
                                  position: frozenLeft != null ? 'sticky' : undefined,
                                  left: frozenLeft,
                                  zIndex: frozenLeft != null ? 2 : undefined,
                                  background: '#fff',
                                }}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={rowChecked}
                                  onChange={() => toggleRow(row)}
                                  onClick={(event) => event.stopPropagation()}
                                  className="w-4 h-4 rounded border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer"
                                  aria-label={`Select row ${rowId}`}
                                />
                              </td>
                            );
                          }
                          if (col.id === 'actions') {
                            return (
                              <td
                                key={col.id}
                                className="sticky right-0 z-10 py-2 text-center bg-white border-l-2 border-gray-200 shadow-[-4px_0_8px_rgba(0,0,0,0.06)]"
                                style={{ paddingLeft: 10, paddingRight: 10 }}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="relative flex justify-center items-center w-full">
                                  {renderActions ? renderActions(row) : null}
                                </div>
                              </td>
                            );
                          }
                          const isActive = activeCell?.rowIndex === rowIndex && activeCell.columnId === col.id;
                          const inRange = isHubCellInRange(rowIndex, col.id, selectionRange);
                          const columnSelected = selectedColumnId === col.id;
                          const bg = isActive ? '#e5e5e5' : inRange || rowChecked ? '#f5f5f5' : columnSelected ? '#fafafa' : '#fff';
                          return (
                            <td
                              key={col.id}
                              tabIndex={isActive ? 0 : -1}
                              data-hub-cell={hubActiveCellKey({ rowIndex, columnId: col.id })}
                              aria-selected={isActive || undefined}
                              className={`px-3 py-2 max-w-0 overflow-hidden border-r border-gray-200 outline-none ${
                                col.id === primaryId ? 'font-medium text-gray-900' : 'text-sm text-gray-700'
                              } ${isActive ? 'shadow-[inset_0_0_0_2px_#000]' : ''}`}
                              style={{
                                background: bg,
                                position: frozenLeft != null ? 'sticky' : undefined,
                                left: frozenLeft,
                                zIndex: frozenLeft != null ? 2 : undefined,
                                boxShadow: isLastFrozen && !isActive ? '4px 0 8px rgba(0,0,0,0.06)' : undefined,
                              }}
                              onClick={(event) => {
                                if (isHubInteractiveClickTarget(event.target)) return;
                                event.stopPropagation();
                                if (event.shiftKey || event.ctrlKey || event.metaKey) {
                                  if (bulkActions) {
                                    applyRowKeys(rowId, {
                                      shiftKey: event.shiftKey,
                                      ctrlKey: event.ctrlKey || event.metaKey,
                                    });
                                  }
                                  selectCell(rowIndex, col.id, event.shiftKey);
                                  return;
                                }
                                if (isActive) {
                                  onRowClick?.(row);
                                  return;
                                }
                                selectCell(rowIndex, col.id, false);
                                if (bulkActions) rowAnchorRef.current = rowId;
                              }}
                              onDoubleClick={(event) => {
                                if (isHubInteractiveClickTarget(event.target)) return;
                                event.stopPropagation();
                                onRowClick?.(row);
                              }}
                            >
                              <div className={col.wrap ? 'whitespace-normal' : 'truncate'}>{renderCell(row, col.id)}</div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && visibleTotal > 0 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={visibleTotal}
            itemsPerPage={pageSize}
            itemLabel={itemLabel}
          />
        </div>
      )}

      {menuColumn && columnMenu && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-hub-column-menu=""
              className="fixed z-[80] w-72 rounded-lg border-2 border-black bg-white p-2 text-black shadow-lg"
              style={{ left: columnMenu.x, top: columnMenu.y }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 cursor-pointer"
                onClick={() => sortColumn(menuColumn, 'asc')}
              >
                <ArrowUpAZ className="h-4 w-4" />
                Sort A to Z
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 cursor-pointer"
                onClick={() => sortColumn(menuColumn, 'desc')}
              >
                <ArrowDownAZ className="h-4 w-4" />
                Sort Z to A
              </button>
              <div className="my-2 border-t border-gray-200" />
              <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Filter</div>
              <input
                value={filterDraft.query}
                onChange={(event) => setFilterDraft((prev) => ({ ...prev, query: event.target.value }))}
                placeholder="Search values"
                className="mb-2 w-full rounded-lg border-2 border-black px-2 py-1 text-sm outline-none"
              />
              <div className="max-h-40 overflow-auto rounded-md border border-gray-200">
                {uniqueValues
                  .filter((value) =>
                    filterDraft.query.trim()
                      ? value.toLowerCase().includes(filterDraft.query.trim().toLowerCase())
                      : true
                  )
                  .slice(0, 80)
                  .map((value) => {
                    const checked = !filterDraft.values || filterDraft.values.includes(value);
                    return (
                      <label key={value || '(blank)'} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-neutral-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setFilterDraft((prev) => {
                              const all = uniqueValues;
                              const current = prev.values ?? all;
                              const next = current.includes(value)
                                ? current.filter((item) => item !== value)
                                : [...current, value];
                              return { ...prev, values: next.length === all.length ? null : next };
                            });
                          }}
                          className="accent-black"
                        />
                        <span className="truncate">{value || '(Blank)'}</span>
                      </label>
                    );
                  })}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md border-2 border-black bg-black px-2 py-1 text-sm font-medium text-white cursor-pointer"
                  onClick={() => {
                    const next = {
                      query: filterDraft.query.trim(),
                      values: filterDraft.values,
                    };
                    setColumnFilters((prev) => {
                      const copy = { ...prev };
                      if (!next.query && !next.values) delete copy[menuColumn.id];
                      else copy[menuColumn.id] = next;
                      return copy;
                    });
                    if (clientSide) setInternalPage(1);
                    setColumnMenu(null);
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-md border-2 border-gray-300 px-2 py-1 text-sm cursor-pointer hover:bg-neutral-100"
                  onClick={() => {
                    setColumnFilters((prev) => {
                      const copy = { ...prev };
                      delete copy[menuColumn.id];
                      return copy;
                    });
                    setFilterDraft({ query: '', values: null });
                    setColumnMenu(null);
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="my-2 border-t border-gray-200" />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 cursor-pointer"
                onClick={() => {
                  void copyText(menuColumn.label, 'Copied');
                  setColumnMenu(null);
                }}
              >
                <Copy className="h-4 w-4" />
                Copy name
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 cursor-pointer"
                onClick={() => persistFreeze(frozenUntilId === menuColumn.id ? null : menuColumn.id)}
              >
                {frozenUntilId === menuColumn.id ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {frozenUntilId === menuColumn.id ? 'Unfreeze columns' : 'Freeze column'}
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
