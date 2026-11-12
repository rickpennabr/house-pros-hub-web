'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { MoreVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { CatalogDeleteDialog } from '@/components/crm/catalog/catalog-delete-dialog';
import { ServiceEditor } from '@/components/crm/catalog/service-editor';
import { formatServicePrice } from '@/lib/crm/catalog-options';
import type { CrmCatalogTerm, CrmService } from '@/lib/crm/catalog-types';

const ACTIONS_MENU_HEIGHT = 132;

const COLUMNS: AdminDataTableColumn<CrmService>[] = [
  { id: 'photo', label: 'Photo', width: 120, resizable: false },
  { id: 'name', label: 'Name', width: 280 },
  { id: 'category', label: 'Category', width: 140 },
  { id: 'unit', label: 'Unit', width: 100 },
  { id: 'price_type', label: 'Price type', width: 130 },
  { id: 'price', label: 'Price', width: 160 },
  { id: 'description', label: 'Description', width: 240, wrap: true },
  { id: 'actions', label: 'Actions', resizable: false },
];

function cellText(service: CrmService, columnId: string): string {
  switch (columnId) {
    case 'name':
      return service.name;
    case 'category':
      return service.category ?? '';
    case 'unit':
      return service.unit;
    case 'price_type':
      return service.price_type;
    case 'price':
      return formatServicePrice(service);
    case 'description':
      return service.description ?? '';
    default:
      return '';
  }
}

function copyName(baseName: string, existing: CrmService[]): string {
  const names = new Set(existing.map((service) => service.name.trim().toLowerCase()));
  const plain = `${baseName} (Copy)`;
  if (!names.has(plain.toLowerCase())) return plain;
  let index = 2;
  while (index < 500) {
    const numbered = `${baseName} (Copy ${index})`;
    if (!names.has(numbered.toLowerCase())) return numbered;
    index += 1;
  }
  return `${baseName} (Copy ${Date.now()})`;
}

export default function CRMServicesPage() {
  const searchParams = useSearchParams();
  const [services, setServices] = useState<CrmService[]>([]);
  const [terms, setTerms] = useState<CrmCatalogTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CrmService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmService | null>(null);
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [serviceResponse, termResponse] = await Promise.all([
        fetch('/api/crm/services', { credentials: 'include' }),
        fetch('/api/crm/catalog-terms', { credentials: 'include' }),
      ]);
      const serviceData = await serviceResponse.json().catch(() => ({}));
      const termData = await termResponse.json().catch(() => ({}));
      if (!serviceResponse.ok) throw new Error(serviceData.error || 'Failed to load services');
      setServices(serviceData.services ?? []);
      if (termResponse.ok) setTerms(termData.terms ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setEditing(null);
    setEditorOpen(true);
  }, [searchParams]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const duplicate = async (service: CrmService) => {
    setError(null);
    const response = await fetch('/api/crm/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: copyName(service.name, services),
        category: service.category ?? '',
        description: service.description ?? '',
        unit: service.unit,
        price_type: service.price_type,
        price_mode: service.price_mode,
        price_cents: service.price_cents,
        price_min_cents: service.price_min_cents,
        price_max_cents: service.price_max_cents,
        images: service.images.map((image) => ({
          image_url: image.image_url,
          storage_path: image.storage_path,
          is_thumbnail: image.is_thumbnail,
        })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Failed to duplicate the service');
      return;
    }
    setServices((current) => [...current, data.service as CrmService]);
  };

  const removeIds = async (ids: string[]) => {
    setDeleting(true);
    setError(null);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/crm/services/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to delete the service');
      }
      setServices((current) => current.filter((service) => !ids.includes(service.id)));
      setDeleteTarget(null);
      setBulkIds(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the service');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Services</h1>
          <p className="mt-0.5 text-sm text-gray-500">Labor and other services you put on estimates.</p>
        </div>
        <Button variant="primary" size="sm" className="flex shrink-0 items-center gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" />
          New service
        </Button>
      </div>
      <AdminDataTable
        clientSide
        columnOrderKey="crm-services"
        exportName="services"
        columns={COLUMNS}
        data={services}
        total={services.length}
        pageSize={25}
        isLoading={loading}
        hasLoadedOnce={!loading}
        error={error}
        getRowId={(row) => row.id}
        getCellText={cellText}
        searchPlaceholder="Search services..."
        emptyMessage="No services yet. Add the first one."
        itemLabel="services"
        primaryColumnId="name"
        onRowClick={(row) => {
          setEditing(row);
          setEditorOpen(true);
        }}
        renderCell={(row, columnId) => {
          if (columnId === 'photo') {
            const photo = row.images.find((image) => image.is_thumbnail)?.image_url ?? row.images[0]?.image_url;
            return photo ? <img src={photo} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="inline-block h-10 w-10 rounded bg-neutral-100" />;
          }
          return cellText(row, columnId) || '—';
        }}
        renderActions={(row) => (
          <button
            type="button"
            className="cursor-pointer rounded p-1 text-gray-600 hover:bg-gray-200"
            aria-label="Actions"
            onClick={(event) => {
              event.stopPropagation();
              if (openActionsId === row.id) {
                setOpenActionsId(null);
                setMenuPosition(null);
                return;
              }
              const rect = event.currentTarget.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom - 4;
              const top = spaceBelow >= ACTIONS_MENU_HEIGHT ? rect.bottom + 4 : Math.max(8, rect.top - ACTIONS_MENU_HEIGHT - 4);
              setMenuPosition({ top, left: Math.max(8, Math.min(rect.right - 140, window.innerWidth - 150)) });
              setOpenActionsId(row.id);
            }}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        )}
        bulkActions={{
          onDelete: (ids) => setBulkIds(ids),
          onEdit: (row) => {
            setEditing(row);
            setEditorOpen(true);
          },
          onCopyAsJson: (rows) => {
            void navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
          },
        }}
      />

      <ServiceEditor
        open={editorOpen}
        initial={editing}
        terms={terms}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onTermsChange={setTerms}
        onSaved={(service) => {
          setServices((current) => {
            const index = current.findIndex((row) => row.id === service.id);
            if (index === -1) return [...current, service];
            const next = [...current];
            next[index] = service;
            return next;
          });
        }}
      />

      {openActionsId && menuPosition
        ? createPortal(
            <div className="fixed z-[100] min-w-[140px] rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg" style={{ top: menuPosition.top, left: menuPosition.left }}>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={() => { const row = services.find((service) => service.id === openActionsId); setOpenActionsId(null); if (row) { setEditing(row); setEditorOpen(true); } }}>Edit</button>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={() => { const row = services.find((service) => service.id === openActionsId); setOpenActionsId(null); if (row) void duplicate(row); }}>Duplicate</button>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100" onClick={() => { const row = services.find((service) => service.id === openActionsId); setOpenActionsId(null); if (row) setDeleteTarget(row); }}>Delete</button>
            </div>,
            document.body
          )
        : null}

      {deleteTarget ? (
        <CatalogDeleteDialog
          title="Delete service?"
          message={`This removes ${deleteTarget.name} from your services.`}
          confirmLabel="Delete"
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void removeIds([deleteTarget.id])}
        />
      ) : null}
      {bulkIds && bulkIds.length > 0 ? (
        <CatalogDeleteDialog
          title="Delete services?"
          message={`Delete ${bulkIds.length} service${bulkIds.length === 1 ? '' : 's'}? This cannot be undone.`}
          confirmLabel={`Delete ${bulkIds.length}`}
          deleting={deleting}
          onCancel={() => setBulkIds(null)}
          onConfirm={() => void removeIds(bulkIds)}
        />
      ) : null}
    </div>
  );
}
