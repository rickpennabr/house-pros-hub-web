'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { Supplier } from '@/app/[locale]/(main)/prosuppliers/SupplierCard';
import { ChevronDown, Search, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';

const BULK_SELECT_COLUMN_WIDTH = 44;

// Import suppliers data from SuppliersList
const suppliers: Supplier[] = [
  {
    id: 1,
    name: 'Site One Landscape Supply - Decatur',
    type: 'Pavers Supplier',
    materials: ['Pavers', 'Base Materials', 'Sand'],
    address: '5455 S Decatur Blvd, Las Vegas, NV 89118',
    phone: '(702) 873-3700',
    website: 'https://www.siteone.com',
    coordinates: { lat: 36.0872, lng: -115.2087 },
  },
  {
    id: 2,
    name: 'Site One Landscape Supply - Henderson',
    type: 'Pavers Supplier',
    materials: ['Pavers', 'Base Materials', 'Sand'],
    address: '1801 N Boulder Hwy, Henderson, NV 89011',
    phone: '(702) 565-1300',
    website: 'https://www.siteone.com',
    coordinates: { lat: 36.0395, lng: -114.9672 },
  },
  {
    id: 3,
    name: 'Site One Landscape Supply - North Las Vegas',
    type: 'Pavers Supplier',
    materials: ['Pavers', 'Base Materials', 'Sand'],
    address: '3290 N Las Vegas Blvd, Las Vegas, NV 89115',
    phone: '(702) 649-7200',
    website: 'https://www.siteone.com',
    coordinates: { lat: 36.2176, lng: -115.1153 },
  },
  {
    id: 4,
    name: 'Apache Stone - Las Vegas',
    type: 'Stone Supplier',
    materials: ['Travertine', 'Porcelain', 'Natural Stone'],
    address: '4585 W Post Rd, Las Vegas, NV 89118',
    phone: '(702) 222-2222',
    website: 'https://www.apachestone.com',
    coordinates: { lat: 36.0922, lng: -115.2047 },
  },
  {
    id: 5,
    name: 'Apache Stone - Henderson',
    type: 'Stone Supplier',
    materials: ['Travertine', 'Porcelain', 'Natural Stone'],
    address: '1675 W Horizon Ridge Pkwy, Henderson, NV 89012',
    phone: '(702) 333-3333',
    website: 'https://www.apachestone.com',
    coordinates: { lat: 36.0016, lng: -115.0691 },
  },
  {
    id: 6,
    name: 'Vegas Stone Brokers',
    type: 'Miscellaneous Supplier',
    materials: ['Pavers', 'Travertine', 'Porcelain', 'Tools'],
    address: '4444 W Russell Rd, Las Vegas, NV 89118',
    phone: '(702) 444-4444',
    website: 'https://www.vegasstonebrokers.com',
    coordinates: { lat: 36.0972, lng: -115.1987 },
  },
  {
    id: 7,
    name: 'Star Nursery',
    type: 'Base Material Supplier',
    materials: ['Base Materials', 'Sand', 'Rock'],
    address: '3340 W Ann Rd, North Las Vegas, NV 89031',
    phone: '(702) 555-5555',
    website: 'https://www.starnursery.com',
    coordinates: { lat: 36.1022, lng: -115.1927 },
  },
  {
    id: 8,
    name: 'Belgard Hardscapes',
    type: 'Pavers Manufacturer',
    materials: ['Pavers', 'Retaining Walls', 'Outdoor Living'],
    address: '375 N Stephanie St, Henderson, NV 89014',
    phone: '(702) 567-8900',
    website: 'https://www.belgard.com',
    coordinates: { lat: 36.0395, lng: -115.0457 },
  },
  {
    id: 9,
    name: 'Paver Pros Supply',
    type: 'Paver Tools Supplier',
    materials: ['Tools', 'Sealers', 'Cleaners'],
    address: '6360 S Pecos Rd, Las Vegas, NV 89120',
    phone: '(702) 778-9999',
    website: 'https://www.paverprossupply.com',
    coordinates: { lat: 36.0722, lng: -115.1017 },
  },
  {
    id: 10,
    name: 'Rock & Stone Supply',
    type: 'Landscaping Materials Supplier',
    materials: ['Rock', 'Gravel', 'Boulders'],
    address: '5720 S Valley View Blvd, Las Vegas, NV 89118',
    phone: '(702) 876-5555',
    website: 'https://www.rockandstonesupply.com',
    coordinates: { lat: 36.0872, lng: -115.1887 },
  },
  {
    id: 11,
    name: 'Concrete Solutions',
    type: 'Concrete and Masonry Supplier',
    materials: ['Concrete', 'Cement', 'Masonry Tools'],
    address: '4050 W Mesa Vista Ave, Las Vegas, NV 89118',
    phone: '(702) 989-7777',
    website: 'https://www.concretesolutionslv.com',
    coordinates: { lat: 36.0922, lng: -115.1787 },
  },
  {
    id: 12,
    name: 'Boulder Placement Specialists',
    type: 'Boulder Supplier and Placement',
    materials: ['Boulders', 'Decorative Rocks'],
    address: '3111 S Valley View Blvd, Las Vegas, NV 89102',
    phone: '(702) 123-4567',
    website: 'https://www.boulderplacementspecialists.com',
    coordinates: { lat: 36.1287, lng: -115.191 },
  },
  {
    id: 13,
    name: 'Bedrock Supply Co.',
    type: 'Bedrock and Base Materials',
    materials: ['Bedrock', 'Base Materials', 'Aggregates'],
    address: '4675 Wynn Rd, Las Vegas, NV 89103',
    phone: '(702) 987-6543',
    website: 'https://www.bedrocksupplyco.com',
    coordinates: { lat: 36.1066, lng: -115.1895 },
  },
];

export default function SuppliersPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        id: 'select',
        size: BULK_SELECT_COLUMN_WIDTH,
        minSize: BULK_SELECT_COLUMN_WIDTH,
        maxSize: BULK_SELECT_COLUMN_WIDTH,
        enableSorting: false,
        header: ({ table }) => {
          const rows = table.getRowModel().rows;
          const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.original.id));
          const someSelected = rows.some((r) => selectedIds.has(r.original.id));
          return (
            <input
              type="checkbox"
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              checked={allSelected}
              onChange={() => {
                if (allSelected) {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    rows.forEach((r) => next.delete(r.original.id));
                    return next;
                  });
                } else {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    rows.forEach((r) => next.add(r.original.id));
                    return next;
                  });
                }
              }}
              className="w-4 h-4 rounded border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer"
              aria-label="Select all on page"
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => {}}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(row.original.id)) next.delete(row.original.id);
                else next.add(row.original.id);
                return next;
              });
            }}
            className="w-4 h-4 rounded border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer"
            aria-label={`Select row ${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: 'id',
        header: 'ID',
        size: 80,
        minSize: 60,
        maxSize: 120,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        size: 250,
        minSize: 150,
        maxSize: 400,
        cell: ({ getValue }) => {
          const name = getValue<string>();
          const parts = name.split(' - ');
          return (
            <div className="font-medium text-black">
              {parts[0]}
              {parts.length > 1 && (
                <span className="text-gray-600 text-sm"> - {parts.slice(1).join(' - ')}</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        size: 200,
        minSize: 120,
        maxSize: 300,
      },
      {
        accessorKey: 'materials',
        header: 'Materials',
        size: 250,
        minSize: 150,
        maxSize: 400,
        cell: ({ getValue }) => {
          const materials = getValue<string[]>();
          return (
            <div className="flex flex-wrap gap-1">
              {materials.map((material, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-black text-white text-xs rounded font-medium"
                >
                  {material}
                </span>
              ))}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const materials = row.getValue(id) as string[];
          return materials.some((material) =>
            material.toLowerCase().includes(value.toLowerCase())
          );
        },
      },
      {
        accessorKey: 'address',
        header: 'Address',
        size: 300,
        minSize: 200,
        maxSize: 500,
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        size: 150,
        minSize: 120,
        maxSize: 200,
      },
      {
        accessorKey: 'website',
        header: 'Website',
        size: 200,
        minSize: 150,
        maxSize: 300,
        cell: ({ getValue }) => {
          const website = getValue<string>();
          return website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline truncate block"
            >
              {website}
            </a>
          ) : (
            <span className="text-gray-400">-</span>
          );
        },
      },
    ],
    [selectedIds]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: suppliers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      const name = (row.getValue('name') as string)?.toLowerCase() || '';
      const type = (row.getValue('type') as string)?.toLowerCase() || '';
      const address = (row.getValue('address') as string)?.toLowerCase() || '';
      const phone = (row.getValue('phone') as string)?.toLowerCase() || '';
      const website = (row.getValue('website') as string)?.toLowerCase() || '';
      const materials = (row.getValue('materials') as string[]) || [];
      const materialsStr = materials.join(' ').toLowerCase();
      
      return (
        name.includes(search) ||
        type.includes(search) ||
        address.includes(search) ||
        phone.includes(search) ||
        website.includes(search) ||
        materialsStr.includes(search)
      );
    },
    state: {
      sorting,
      columnFilters,
      columnSizing,
      globalFilter,
    },
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  const selectedRows = useMemo(
    () => suppliers.filter((s) => selectedIds.has(s.id)),
    [suppliers, selectedIds]
  );

  const handleBulkCopyAsJson = () => {
    const json = JSON.stringify(selectedRows, null, 2);
    void navigator.clipboard.writeText(json);
    setSelectedIds(new Set());
  };

  const handleBulkEdit = () => {
    if (selectedRows.length !== 1) return;
    // Edit single supplier - no-op for static data; could open modal later
    setSelectedIds(new Set());
  };

  return (
    <div className="w-full">
      <AdminFloatingAddButton href="/admin/customers" ariaLabel="Add customer" />
      <div className="mb-2 md:mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-semibold text-black">Suppliers</h1>
            <p className="text-gray-600">
              Total: {table.getFilteredRowModel().rows.length} supplier
              {table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="primary" size="sm" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 pb-3 px-1 border-b border-gray-200 bg-gray-50 rounded-lg py-2 mb-4">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            className="text-sm font-medium text-red-600 hover:text-red-700 opacity-60 cursor-not-allowed border-2 border-red-600"
            title="Bulk delete not available for suppliers"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleBulkCopyAsJson}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer px-2 py-1 rounded hover:bg-gray-100 border-b-2 border-black"
          >
            Copy as JSON
          </button>
          {selectedIds.size === 1 && (
            <button
              type="button"
              onClick={handleBulkEdit}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer px-2 py-1 rounded hover:bg-gray-100 border-2 border-gray-400"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Global Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
          <input
            type="text"
            placeholder="Search all columns..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full h-10 pl-10 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none transition-all text-black placeholder-gray-500"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border-2 border-black rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ width: table.getTotalSize() }}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-black">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-white font-semibold px-4 py-3 text-left border-r-2 border-gray-700 last:border-r-0 relative select-none"
                      style={{
                        width: header.getSize(),
                        minWidth: header.column.columnDef.minSize,
                        maxWidth: header.column.columnDef.maxSize,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 hover:text-gray-200 transition-colors"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ChevronDown 
                            size={16} 
                            className={`transition-transform ${
                              header.column.getIsSorted() === 'asc' ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-gray-600 border-b-2 border-black"
                  >
                    No suppliers found matching your filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b-2 border-black hover:bg-gray-50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 text-black border-r-2 border-gray-200 last:border-r-0"
                        style={{
                          width: cell.column.getSize(),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

