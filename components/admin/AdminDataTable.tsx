'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';

const ACTIONS_COLUMN_WIDTH = 72;
const BULK_SELECT_COLUMN_WIDTH = 44;
const MIN_COLUMN_WIDTH = 60;

export interface AdminDataTableColumn<T> {
  id: string;
  label: string;
  /** If set, column header shows sort dropdown and uses this key for onSort */
  sortKey?: string;
  /** If false, column is not resizable (e.g. actions). Default true for data columns. */
  resizable?: boolean;
}

export interface AdminDataTableBulkActions<T> {
  onDelete?: (ids: string[]) => void;
  onCopyAsJson?: (rows: T[]) => void;
  /** Shown only when exactly one row is selected */
  onEdit?: (row: T) => void;
  /** Labels (optional) */
  labelDelete?: string;
  labelCopyAsJson?: string;
  labelEdit?: string;
}

export interface AdminDataTableProps<T> {
  /** Column definitions (order = display order). Include an 'actions' column if renderActions is provided. */
  columns: AdminDataTableColumn<T>[];
  /** Data rows */
  data: T[];
  /** Total count for pagination */
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string, dir: 'asc' | 'desc') => void;
  /** Search */
  searchInput: string;
  onSearchInput: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  searchPlaceholder?: string;
  /** State */
  isLoading: boolean;
  isRefetching?: boolean;
  hasLoadedOnce?: boolean;
  error: string | null;
  /** Row key for React list */
  getRowId: (row: T) => string;
  /** Render cell content for a column (excluding actions) */
  renderCell: (row: T, columnId: string) => React.ReactNode;
  /** Optional: row click (e.g. open edit) */
  onRowClick?: (row: T) => void;
  /** Render actions cell (⋮ button etc.). Column with id 'actions' must exist in columns. */
  renderActions?: (row: T) => React.ReactNode;
  /** When set, adds a select column on the left and shows bulk actions toolbar when selection is not empty */
  bulkActions?: AdminDataTableBulkActions<T>;
  emptyMessage?: string;
  itemLabel?: string;
  /** Column id for primary column (font-medium text-gray-900). Default: first data column. */
  primaryColumnId?: string;
  /** Column ids that can be resized (default: all except 'actions') */
  resizableColumnIds?: readonly string[];
  minColumnWidth?: number;
  tableLayoutMinWidth?: number;
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: 'asc' | 'desc';
  onSort: (key: string, dir: 'asc' | 'desc') => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative flex items-center justify-between gap-3 w-full min-w-0" ref={ref}>
      <span className="font-semibold text-white whitespace-nowrap">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-0.5 rounded hover:bg-white/20 transition-colors text-white cursor-pointer"
        aria-label="Sort options"
      >
        <ChevronDown className="w-4 h-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] py-1 bg-white border border-gray-200 rounded-md shadow-lg text-black">
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              onSort(sortKey, 'asc');
              setOpen(false);
            }}
          >
            Ascending (A→Z)
          </button>
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              onSort(sortKey, 'desc');
              setOpen(false);
            }}
          >
            Descending (Z→A)
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminDataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  sortBy,
  sortDir,
  onSort,
  searchInput,
  onSearchInput,
  onSearchSubmit,
  searchPlaceholder = 'Search…',
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
  const displayColumns = useMemo(
    () =>
      bulkActions
        ? ([{ id: 'select', label: '', resizable: false }, ...columns] as (AdminDataTableColumn<T> & { id: string })[])
        : columns,
    [bulkActions, columns]
  );
  const firstDataColumnId = displayColumns.find((c) => c.id !== 'actions' && c.id !== 'select')?.id;
  const primaryId = primaryColumnId ?? firstDataColumnId;
  const tableRef = useRef<HTMLTableElement>(null);
  const [columnWidths, setColumnWidths] = useState<Partial<Record<string, number>>>({});
  const [resizing, setResizing] = useState<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedRows = useMemo(
    () => data.filter((row) => selectedIds.has(getRowId(row))),
    [data, getRowId, selectedIds]
  );
  const allOnPageSelected = data.length > 0 && data.every((row) => selectedIds.has(getRowId(row)));
  const someOnPageSelected = data.some((row) => selectedIds.has(getRowId(row)));

  useEffect(() => {
    const idsInData = new Set(data.map(getRowId));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => idsInData.has(id)));
      return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next;
    });
  }, [data, getRowId]);

  const canResize = (colId: string) => {
    if (colId === 'actions' || colId === 'select') return false;
    if (resizableColumnIds) return resizableColumnIds.includes(colId);
    return true;
  };

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        data.forEach((row) => next.delete(getRowId(row)));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        data.forEach((row) => next.add(getRowId(row)));
        return next;
      });
    }
  };

  const toggleRow = (row: T, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = getRowId(row);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  const handleBulkDelete = () => {
    if (bulkActions?.onDelete && selectedRows.length > 0) {
      bulkActions.onDelete(selectedRows.map(getRowId));
      // Do not clear selection here; parent may show confirm modal. Selection is pruned when data refetches.
    }
  };
  const handleBulkCopyAsJson = () => {
    if (bulkActions?.onCopyAsJson && selectedRows.length > 0) {
      bulkActions.onCopyAsJson(selectedRows);
      clearSelection();
    }
  };
  const handleBulkEdit = () => {
    if (bulkActions?.onEdit && selectedRows.length === 1) {
      bulkActions.onEdit(selectedRows[0]);
      clearSelection();
    }
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
  }, [resizing, minColumnWidth]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      {bulkActions && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 pb-3 px-1 border-b border-gray-200 bg-gray-50 rounded-lg py-2 mb-2">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} selected
          </span>
          {bulkActions.onDelete && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="text-sm font-medium text-red-600 hover:text-red-700 cursor-pointer px-2 py-1 rounded hover:bg-red-50 border-2 border-red-600"
            >
              {bulkActions.labelDelete ?? 'Delete'}
            </button>
          )}
          {bulkActions.onCopyAsJson && (
            <button
              type="button"
              onClick={handleBulkCopyAsJson}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer px-2 py-1 rounded hover:bg-gray-100 border-2 border-black"
            >
              {bulkActions.labelCopyAsJson ?? 'Copy as JSON'}
            </button>
          )}
          {bulkActions.onEdit && selectedIds.size === 1 && (
            <button
              type="button"
              onClick={handleBulkEdit}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
            >
              {bulkActions.labelEdit ?? 'Edit'}
            </button>
          )}
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer px-2 py-1 rounded hover:bg-gray-100 border-2 border-gray-400"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <form onSubmit={onSearchSubmit} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-9 pr-3 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-[#1a1a1a] text-black dark:text-gray-100 placeholder:dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="h-9 px-4 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {isLoading && !hasLoadedOnce ? (
          <div className="p-12 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto relative">
            {isRefetching && (
              <div
                className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-lg"
                aria-hidden
              >
                <span className="text-sm text-gray-500">Updating…</span>
              </div>
            )}
            <table
              ref={tableRef}
              className="w-full border-collapse"
              style={{ tableLayout: 'fixed', minWidth: tableLayoutMinWidth }}
            >
              <colgroup>
                {displayColumns.map((col) => (
                  <col
                    key={col.id}
                    data-col-id={col.id}
                    style={
                      col.id === 'actions'
                        ? { width: ACTIONS_COLUMN_WIDTH, minWidth: ACTIONS_COLUMN_WIDTH }
                        : col.id === 'select'
                          ? { width: BULK_SELECT_COLUMN_WIDTH, minWidth: BULK_SELECT_COLUMN_WIDTH }
                          : columnWidths[col.id]
                            ? {
                                width: columnWidths[col.id],
                                minWidth: columnWidths[col.id],
                              }
                            : undefined
                    }
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b-2 border-black bg-black text-white">
                  {displayColumns.map((col) => (
                    <th
                      key={col.id}
                      className={
                        col.id === 'actions'
                          ? 'sticky right-0 z-10 py-1.5 text-center bg-black border-l-2 border-white shadow-[-4px_0_8px_rgba(0,0,0,0.15)] box-border whitespace-nowrap'
                          : col.id === 'select'
                            ? 'py-1.5 text-center bg-black border-r border-white w-[44px] cursor-pointer'
                            : 'relative px-4 py-1.5 text-left border-r border-white whitespace-nowrap select-none'
                      }
                      style={
                        col.id === 'actions'
                          ? { paddingLeft: 10, paddingRight: 10 }
                          : col.id === 'select'
                            ? { paddingLeft: 8, paddingRight: 8 }
                            : undefined
                      }
                    >
                      {col.id === 'select' ? (
                        <input
                          type="checkbox"
                          ref={selectAllRef}
                          checked={allOnPageSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer"
                          aria-label="Select all on page"
                        />
                      ) : col.id === 'actions' ? (
                        <span className="font-semibold text-white whitespace-nowrap">
                          Actions
                        </span>
                      ) : col.sortKey ? (
                        <SortHeader
                          label={col.label}
                          sortKey={col.sortKey}
                          currentSort={sortBy}
                          currentDir={sortDir}
                          onSort={onSort}
                        />
                      ) : (
                        <span className="font-semibold text-white whitespace-nowrap">
                          {col.label}
                        </span>
                      )}
                      {canResize(col.id) && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${col.label} column`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const th = (e.target as HTMLElement).closest('th');
                            const startWidth = th ? th.getBoundingClientRect().width : 120;
                            setResizing({
                              columnId: col.id,
                              startX: e.clientX,
                              startWidth,
                            });
                          }}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize touch-none shrink-0 z-20 hover:bg-white/20"
                          style={{ marginRight: -4 }}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={displayColumns.length}
                      className="px-4 py-12 text-center text-gray-500 text-sm"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr
                      key={getRowId(row)}
                      role={onRowClick ? 'button' : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={
                        onRowClick
                          ? () => onRowClick(row)
                          : undefined
                      }
                      onKeyDown={
                        onRowClick
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onRowClick(row);
                              }
                            }
                          : undefined
                      }
                      className={`group border-b border-gray-100 transition-colors ${
                        onRowClick ? 'hover:bg-gray-50/80 cursor-pointer' : ''
                      } ${selectedIds.has(getRowId(row)) ? 'bg-gray-50/80' : ''}`}
                    >
                      {displayColumns.map((col) =>
                        col.id === 'select' ? (
                          <td
                            key={col.id}
                            className="py-1.5 text-center bg-white group-hover:bg-gray-50/80 border-r border-gray-100 cursor-pointer"
                            style={{ paddingLeft: 8, paddingRight: 8 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(getRowId(row))}
                              onChange={() => {}}
                              onClick={(e) => toggleRow(row, e)}
                              className="w-4 h-4 rounded border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer"
                              aria-label={`Select row ${getRowId(row)}`}
                            />
                          </td>
                        ) : col.id === 'actions' ? (
                          <td
                            key={col.id}
                            className="sticky right-0 z-10 py-1.5 text-center bg-white group-hover:bg-gray-50/80 border-l-2 border-gray-100 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] box-border"
                            style={{ paddingLeft: 10, paddingRight: 10 }}
                          >
                            <div className="relative flex justify-center items-center w-full">
                              {renderActions ? renderActions(row) : null}
                            </div>
                          </td>
                        ) : (
                          <td
                            key={col.id}
                            className={`px-4 py-1.5 max-w-0 overflow-hidden ${
                              col.id === primaryId
                                ? 'font-medium text-gray-900'
                                : 'text-sm text-gray-600'
                            }`}
                          >
                            <span className="truncate block">
                              {renderCell(row, col.id)}
                            </span>
                          </td>
                        )
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && total > 0 && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            totalItems={total}
            itemsPerPage={pageSize}
            itemLabel={itemLabel}
          />
        </div>
      )}
    </>
  );
}
