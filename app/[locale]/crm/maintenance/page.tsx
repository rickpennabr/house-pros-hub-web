'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CalendarDays, ClipboardList, FileInput, Home, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MaintenanceVisitFlow } from '@/components/maintenance/MaintenanceVisitFlow';
import { MaintenanceHousesView } from '@/components/maintenance/MaintenanceHousesView';
import { NextVisitsView } from '@/components/maintenance/NextVisitsView';
import { ImportHouseFromEstimateModal } from '@/components/maintenance/ImportHouseFromEstimateModal';
import { MaintenanceStatCards } from '@/components/maintenance/MaintenanceStatCards';

type Tab = 'houses' | 'next' | 'visits';

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: 'houses', label: 'Houses', Icon: Home },
  { id: 'next', label: 'Next visits', Icon: CalendarDays },
  { id: 'visits', label: 'Visits', Icon: ClipboardList },
];

export default function MaintenancePage() {
  const t = useTranslations('maintenance');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('new') === '1';
  const customerId = searchParams.get('customerId') || '';
  const planId = searchParams.get('planId') || '';
  // Starting a visit always lands on Visits; otherwise the tab comes from the URL.
  const [importOpen, setImportOpen] = useState(false);
  const requestedTab = searchParams.get('tab');
  const tab: Tab = autoStart || requestedTab === 'visits' ? 'visits' : requestedTab === 'next' ? 'next' : 'houses';

  const go = (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const tabs = (
    <div role="tablist" aria-label={t('title')} className="flex items-center gap-2">
      {TABS.map(({ id, label, Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => go(id === 'houses' ? {} : { tab: id })}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border-2 border-black px-4 text-sm font-medium cursor-pointer transition-colors ${
              active ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );

  const addHouse = () => router.push(`/${locale}/crm/maintenance/houses/new`);
  const openHouse = (houseId: string) => router.push(`/${locale}/crm/maintenance/houses/${houseId}`);
  const startVisit = (house: { customerId: string; planId: string }) =>
    go({ new: '1', customerId: house.customerId, planId: house.planId });

  return (
    <div className="w-full space-y-4">
      <div className="hidden md:flex flex-row items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Houses on a maintenance plan, and the visits your crew records at them.
          </p>
        </div>
        {/* Visits keeps its own start button next to the tabs (it changes while traveling). */}
        {tab === 'houses' && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="sm" className="flex items-center gap-2" onClick={() => setImportOpen(true)}>
              <FileInput className="w-4 h-4" />
              Import from estimate
            </Button>
            <Button variant="primary" size="sm" className="flex items-center gap-2" onClick={addHouse}>
              <Plus className="w-4 h-4" />
              Add house
            </Button>
          </div>
        )}
      </div>

      <MaintenanceStatCards onOpenNext={() => go({ tab: 'next' })} />

      {tab === 'visits' ? (
        // Remount when ?new=1 toggles so the Add menu can reopen the start form.
        <MaintenanceVisitFlow
          key={autoStart ? `new-${customerId}-${planId}` : 'list'}
          autoStart={autoStart}
          initialCustomerId={customerId}
          initialPlanId={planId}
          headerStart={tabs}
        />
      ) : tab === 'next' ? (
        <>
          {tabs}
          <NextVisitsView onOpenHouse={openHouse} onStartVisit={startVisit} />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            {tabs}
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 md:hidden"
              onClick={() => setImportOpen(true)}
            >
              <FileInput className="w-4 h-4" />
              Import
            </Button>
          </div>
          <MaintenanceHousesView onOpen={openHouse} onAdd={addHouse} />
          <ImportHouseFromEstimateModal
            isOpen={importOpen}
            onClose={() => setImportOpen(false)}
            onImported={(houseId) => {
              setImportOpen(false);
              openHouse(houseId);
            }}
          />
        </>
      )}
    </div>
  );
}
