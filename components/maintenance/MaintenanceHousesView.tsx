'use client';

import { useState } from 'react';
import { Ban, CalendarClock, CircleAlert, Filter, Home, LayoutGrid, MapPin, Phone, Play, Clock3 } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { MobileGridActionsModal } from '@/components/crm/MobileGridActionsModal';
import { AddressPinsMap } from '@/components/maps/AddressPinsMap';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';
import { ChartLoading, MaintenanceListChart } from '@/components/crm/ListCharts';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';
import Pagination from '@/components/ui/Pagination';
import { CRM_LIST_PAGE_SIZE, useCrmListQuery } from '@/hooks/useCrmListQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  isMaintenanceChart,
  MAINTENANCE_HOUSE_STATUSES,
  maintenanceHouseStatusLabel,
  type MaintenanceHouseStatus,
} from '@/lib/crm/list-charts';
import { formatDurationClock } from '@/lib/crm/maintenance-defaults';

interface HouseRow {
  id: string;
  customerId: string;
  customerName: string;
  /** House nickname from the customer's My Places. */
  placeName: string | null;
  address: string;
  city: string | null;
  phone: string | null;
  status: MaintenanceHouseStatus;
  planName: string;
  frequency: string;
  planCents: number | null;
  nextVisitDate: string | null;
  lastVisitAt: string | null;
  visitCount: number;
  laborSeconds: number;
  openVisitId: string | null;
}

const SORT_KEYS = ['name', 'next_visit', 'last_visit', 'visits', 'status'] as const;

const STATUS_ICONS = {
  overdue: CircleAlert,
  due_soon: CalendarClock,
  scheduled: Clock3,
  ended: Ban,
} as const;

const STATUS_BADGE: Record<MaintenanceHouseStatus, string> = {
  overdue: 'bg-red-600 text-white border-red-600',
  due_soon: 'bg-black text-white border-black',
  scheduled: 'bg-white text-black border-black',
  ended: 'bg-gray-100 text-gray-600 border-gray-300',
};

const COLUMNS: AdminDataTableColumn<HouseRow>[] = [
  { id: 'customerName', label: 'House', sortKey: 'name', width: 200 },
  { id: 'address', label: 'Address', width: 240 },
  { id: 'status', label: 'Status', sortKey: 'status', width: 130 },
  { id: 'plan', label: 'Agreement', width: 180 },
  { id: 'nextVisitDate', label: 'Next visit', sortKey: 'next_visit', width: 130 },
  { id: 'lastVisitAt', label: 'Last visit', sortKey: 'last_visit', width: 130 },
  { id: 'visitCount', label: 'Visits', sortKey: 'visits', width: 90 },
  { id: 'labor', label: 'Labor', width: 110 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function formatDay(value: string | null) {
  if (!value) return '';
  // Plan dates are calendar days (YYYY-MM-DD); keep them from shifting a day by time zone.
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function frequencyLabel(value: string | null) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function planText(row: HouseRow) {
  return row.frequency ? `${row.planName} · ${frequencyLabel(row.frequency)}` : row.planName;
}

function houseLine(row: HouseRow) {
  return [row.placeName, row.address].filter(Boolean).join(' · ');
}

function cellText(row: HouseRow, columnId: string): string {
  switch (columnId) {
    case 'customerName':
      return row.customerName;
    case 'address':
      return houseLine(row);
    case 'status':
      return maintenanceHouseStatusLabel(row.status);
    case 'plan':
      return planText(row);
    case 'nextVisitDate':
      return formatDay(row.nextVisitDate);
    case 'lastVisitAt':
      return formatDay(row.lastVisitAt);
    case 'visitCount':
      return String(row.visitCount);
    case 'labor':
      return row.laborSeconds ? formatDurationClock(row.laborSeconds) : '';
    default:
      return '';
  }
}

function StatusBadge({ status }: { status: MaintenanceHouseStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
      {maintenanceHouseStatusLabel(status)}
    </span>
  );
}

const iconButton =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer';

function HouseCard({
  row,
  onOpen,
  onStart,
}: {
  row: HouseRow;
  onOpen: (row: HouseRow) => void;
  onStart: (row: HouseRow) => void;
}) {
  const mapsUrl = row.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.address)}`
    : null;
  return (
    <div className="relative flex flex-col rounded-lg border-2 border-black bg-white hover:shadow-lg transition-shadow">
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="absolute inset-0 z-[1] cursor-pointer rounded-lg"
        aria-label={`Open ${row.customerName}`}
      />
      <div className="flex items-start gap-3 border-b border-black p-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-black">
          <Home className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-black">{row.customerName}</h3>
          <p className="truncate text-xs text-gray-600">{houseLine(row) || 'No address'}</p>
          <div className="mt-1">
            <StatusBadge status={row.status} />
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 text-xs">
        <div className="col-span-2">
          <dt className="text-gray-500">Agreement</dt>
          <dd className="truncate font-medium text-gray-900">{planText(row) || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Next visit</dt>
          <dd className="font-medium text-gray-900">{formatDay(row.nextVisitDate) || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Last visit</dt>
          <dd className="font-medium text-gray-900">{formatDay(row.lastVisitAt) || '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Visits</dt>
          <dd className="font-medium tabular-nums text-gray-900">{row.visitCount}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Labor</dt>
          <dd className="font-medium tabular-nums text-gray-900">
            {row.laborSeconds ? formatDurationClock(row.laborSeconds) : '—'}
          </dd>
        </div>
      </dl>
      <div className="relative z-[2] mt-auto flex items-center gap-2 border-t border-black p-3">
        {row.phone ? (
          <a href={`tel:${row.phone}`} className={iconButton} aria-label={`Call ${row.customerName}`}>
            <Phone className="h-4 w-4" />
          </a>
        ) : null}
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className={iconButton} aria-label="Open in Maps">
            <MapPin className="h-4 w-4" />
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => onStart(row)}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-black bg-black px-3 text-sm font-medium text-white hover:bg-gray-800 cursor-pointer"
        >
          <Play className="h-4 w-4" />
          {row.openVisitId ? 'Resume visit' : 'Start visit'}
        </button>
      </div>
    </div>
  );
}

interface MaintenanceHousesViewProps {
  /** Opens the house: agreement, job, plants, visits. */
  onOpen: (houseId: string) => void;
  /** Opens the visit flow for this house (a running visit resumes on its own). */
  onStartVisit: (house: { customerId: string; planId: string }) => void;
  onAdd: () => void;
}

/** Houses under maintenance: card, table, map, and chart, like the other CRM lists. */
export function MaintenanceHousesView({ onOpen, onStartVisit, onAdd }: MaintenanceHousesViewProps) {
  const crmChrome = useCRMChrome();
  const [statusFilter, setStatusFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedView, setSavedView] = useLocalStorage<string>('crmMaintenanceHousesView', 'card');
  const listView: ViewType =
    savedView === 'list' || savedView === 'map' || savedView === 'chart' ? savedView : 'card';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const {
    rows,
    total,
    page,
    setPage,
    sortBy,
    sortDir,
    searchInput,
    isLoading,
    error,
    hasLoadedOnce,
    handleSort,
    handleSearchInput,
    handleSearchSubmit,
    chart,
    search,
  } = useCrmListQuery<HouseRow>({
    endpoint: '/api/crm/maintenance/houses',
    rowsKey: 'houses',
    defaultSort: 'next_visit',
    defaultSortDir: 'asc',
    extraParams: {
      status: statusFilter,
      timeZone,
      ...(listView === 'chart' ? { chart: '1' } : {}),
    },
    loadError: 'Failed to load maintenance houses',
  });

  const applyStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    setFiltersOpen(false);
  };

  const start = (row: HouseRow) => onStartVisit({ customerId: row.customerId, planId: row.id });
  const open = (row: HouseRow) => onOpen(row.id);

  const filterButton = !crmChrome?.searchOpen ? (
    <button
      type="button"
      onClick={() => setFiltersOpen(true)}
      className="relative h-11 w-11 shrink-0 rounded-lg border-2 border-black bg-black flex items-center justify-center cursor-pointer hover:bg-gray-800 md:hidden"
      aria-label="Filter"
    >
      <Filter className="w-5 h-5 text-white" />
      {statusFilter ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" /> : null}
    </button>
  ) : null;

  const pillClass = (active: boolean) =>
    `inline-flex h-11 shrink-0 items-center rounded-lg border-2 border-black px-3 text-sm font-medium cursor-pointer ${
      active ? 'bg-black text-white' : 'bg-white text-black'
    }`;

  return (
    <div className="w-full">
      <MobileGridActionsModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter by status"
        items={[
          { id: 'all', label: 'All', icon: LayoutGrid, isActive: statusFilter === '', onClick: () => applyStatusFilter('') },
          ...MAINTENANCE_HOUSE_STATUSES.map((status) => ({
            id: status,
            label: maintenanceHouseStatusLabel(status),
            icon: STATUS_ICONS[status],
            isActive: statusFilter === status,
            onClick: () => applyStatusFilter(status),
          })),
        ]}
      />

      <AdminDataTable
        searchRowClassName="max-md:pt-2"
        searchEndAction={filterButton}
        searchAside={(
          <div className="hidden md:flex md:shrink-0 md:flex-wrap md:items-center md:gap-2">
            <button type="button" onClick={() => applyStatusFilter('')} className={pillClass(statusFilter === '')}>
              All
            </button>
            {MAINTENANCE_HOUSE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => applyStatusFilter(status)}
                className={pillClass(statusFilter === status)}
              >
                {maintenanceHouseStatusLabel(status)}
              </button>
            ))}
          </div>
        )}
        hideBody={listView !== 'list'}
        columnOrderKey="crm-maintenance-houses"
        exportName="maintenance-houses"
        columns={COLUMNS}
        data={rows}
        total={total}
        page={page}
        pageSize={CRM_LIST_PAGE_SIZE}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(key, dir) => {
          if ((SORT_KEYS as readonly string[]).includes(key)) handleSort(key, dir);
        }}
        searchInput={searchInput}
        onSearchInput={handleSearchInput}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder="Search contact, house, or agreement…"
        isLoading={isLoading}
        hasLoadedOnce={hasLoadedOnce}
        error={error}
        getRowId={(row) => row.id}
        getCellText={cellText}
        renderCell={(row, columnId) => {
          if (columnId === 'status') return <StatusBadge status={row.status} />;
          const text = cellText(row, columnId);
          if (columnId === 'visitCount' || columnId === 'labor') {
            return text ? <span className="tabular-nums">{text}</span> : '—';
          }
          return text || '—';
        }}
        onRowClick={open}
        renderActions={(row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              start(row);
            }}
            className="inline-flex items-center gap-1 rounded-lg border-2 border-black px-2 py-1 text-xs font-medium hover:bg-gray-50 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5" />
            {row.openVisitId ? 'Resume' : 'Start'}
          </button>
        )}
        emptyMessage="No maintenance houses yet. Add a house to set up its maintenance agreement."
        itemLabel="houses"
        primaryColumnId="customerName"
      />

      {listView === 'card' && (
        isLoading && !hasLoadedOnce ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading houses…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            {error || 'No maintenance houses yet. Add a house to set up its maintenance agreement.'}
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-3 min-[500px]:grid-cols-2 min-[768px]:grid-cols-3 min-[1100px]:grid-cols-4">
            {rows.map((row) => (
              <HouseCard key={row.id} row={row} onOpen={open} onStart={start} />
            ))}
          </div>
        )
      )}

      {listView === 'chart' && (
        isMaintenanceChart(chart) ? (
          <MaintenanceListChart
            chart={chart}
            filtered={Boolean(search)}
            activeStatus={statusFilter}
            onSelectStatus={applyStatusFilter}
          />
        ) : (
          <ChartLoading error={error} />
        )
      )}

      {listView === 'map' && (
        <AddressPinsMap
          pins={rows.map((row) => ({
            id: row.id,
            title: row.placeName ? `${row.customerName} · ${row.placeName}` : row.customerName,
            detail: [maintenanceHouseStatusLabel(row.status), row.nextVisitDate ? `Next ${formatDay(row.nextVisitDate)}` : '']
              .filter(Boolean)
              .join(' · '),
            address: row.address,
          }))}
          onOpen={(id) => onOpen(id)}
        />
      )}

      {(listView === 'card' || listView === 'map') && !isLoading && total > 0 && (
        <div className="mt-4 pb-24">
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(total / CRM_LIST_PAGE_SIZE))}
            onPageChange={setPage}
            totalItems={total}
            itemsPerPage={CRM_LIST_PAGE_SIZE}
            itemLabel="houses"
          />
        </div>
      )}

      {!isLoading && (
        <ViewToggle
          currentView={listView}
          onViewChange={setSavedView}
          views={['card', 'list', 'map', 'chart']}
          hideBackgroundToggle
          onAdd={onAdd}
          addLabel="Add house"
        />
      )}
    </div>
  );
}
