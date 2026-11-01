'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Supplier } from '@/app/[locale]/(main)/prosuppliers/SupplierCard';
import { loadSuppliers } from '@/lib/data/suppliers';
import { Button } from '@/components/ui/Button';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';

const SUPPLIER_COLUMNS: AdminDataTableColumn<Supplier>[] = [
  { id: 'id', label: 'ID', width: 72 },
  { id: 'name', label: 'Name', width: 240 },
  { id: 'type', label: 'Type', width: 180 },
  { id: 'materials', label: 'Materials', width: 240, wrap: true },
  { id: 'address', label: 'Address', width: 280 },
  { id: 'phone', label: 'Phone', width: 140 },
  { id: 'website', label: 'Website', width: 200 },
];

function supplierCellText(row: Supplier, columnId: string): string {
  switch (columnId) {
    case 'id':
      return String(row.id);
    case 'name':
      return row.name;
    case 'type':
      return row.type;
    case 'materials':
      return row.materials.join(', ');
    case 'address':
      return row.address;
    case 'phone':
      return row.phone;
    case 'website':
      return row.website;
    default:
      return '';
  }
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSuppliers()
      .then((rows) => {
        if (!cancelled) setSuppliers(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSuppliersError(err instanceof Error ? err.message : 'Could not load suppliers');
        }
      })
      .finally(() => {
        if (!cancelled) setSuppliersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full">
      <AdminFloatingAddButton href="/admin/customers" ariaLabel="Add customer" />
      <div className="mb-2 md:mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-semibold text-black">Suppliers</h1>
            <p className="text-gray-600">
              Total: {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="primary" size="sm" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      <AdminDataTable
        clientSide
        columnOrderKey="admin-suppliers"
        exportName="suppliers"
        columns={SUPPLIER_COLUMNS}
        data={suppliers}
        total={suppliers.length}
        pageSize={25}
        isLoading={suppliersLoading}
        hasLoadedOnce={!suppliersLoading}
        error={suppliersError}
        getRowId={(row) => String(row.id)}
        getCellText={supplierCellText}
        searchPlaceholder="Search all columns..."
        emptyMessage="No suppliers found matching your filters."
        itemLabel="suppliers"
        primaryColumnId="name"
        bulkActions={{
          onCopyAsJson: (rows) => {
            void navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
          },
        }}
        renderCell={(row, columnId) => {
          if (columnId === 'name') {
            const parts = row.name.split(' - ');
            return (
              <span className="font-medium text-black">
                {parts[0]}
                {parts.length > 1 ? (
                  <span className="text-gray-600 text-sm"> - {parts.slice(1).join(' - ')}</span>
                ) : null}
              </span>
            );
          }
          if (columnId === 'materials') {
            return (
              <span className="flex flex-wrap gap-1">
                {row.materials.map((material, index) => (
                  <span key={`${material}-${index}`} className="px-2 py-0.5 bg-black text-white text-xs rounded font-medium">
                    {material}
                  </span>
                ))}
              </span>
            );
          }
          if (columnId === 'website') {
            return row.website ? (
              <a href={row.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {row.website}
              </a>
            ) : (
              <span className="text-gray-400">-</span>
            );
          }
          return supplierCellText(row, columnId);
        }}
      />
    </div>
  );
}
