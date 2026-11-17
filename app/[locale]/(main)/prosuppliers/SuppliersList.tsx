'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import SupplierCard, { type Supplier } from './SupplierCard';
import { Button } from '@/components/ui/Button';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';

const SuppliersMap = dynamic(() => import('./SuppliersMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-black bg-gray-50 text-sm text-gray-600">
      Loading map…
    </div>
  ),
});

interface SuppliersListProps {
  initialSuppliers: Supplier[];
}

export default function SuppliersList({ initialSuppliers }: SuppliersListProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [hoveredSupplier, setHoveredSupplier] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<ViewType>('list');
  const [isMobile, setIsMobile] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const suppliers = initialSuppliers;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const canHoverPin = () =>
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const hoverSupplier = (id: number) => {
    if (!canHoverPin()) return;
    setHoveredSupplier(id);
  };

  const clearSupplierHover = (id: number) => {
    setHoveredSupplier((current) => (current === id ? null : current));
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Desktop always shows the map pane — wait for idle so list HTML paints first.
  // Mobile only loads Maps when the user opens map view.
  useEffect(() => {
    const wantsMap = !isMobile || view === 'map';
    if (!wantsMap) {
      setMapReady(false);
      return;
    }
    let cancelled = false;
    const arm = () => {
      if (!cancelled) setMapReady(true);
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleId = idleWindow.requestIdleCallback(arm, { timeout: 1200 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }
    const timer = window.setTimeout(arm, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isMobile, view]);

  const filteredSuppliers = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    if (!searchLower) return suppliers;
    return suppliers.filter((supplier) => {
      return (
        supplier.name.toLowerCase().includes(searchLower) ||
        supplier.type.toLowerCase().includes(searchLower) ||
        supplier.address.toLowerCase().includes(searchLower) ||
        supplier.materials.some((material) => material.toLowerCase().includes(searchLower))
      );
    });
  }, [suppliers, searchTerm]);

  const showMapPane = !isMobile || view === 'map';

  const renderMapError = () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-black bg-gray-50">
      <div className="max-w-md px-4 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-2xl font-bold text-black">Map Configuration Error</h2>
        {!apiKey ? (
          <p className="mb-4 text-gray-700">
            Google Maps API key is missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and restart the server.
          </p>
        ) : (
          <p className="mb-4 text-gray-700">
            There was an error loading Google Maps. Check billing, API enablement, and key restrictions.
          </p>
        )}
        <a
          href="https://console.cloud.google.com/google/maps-apis"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-black px-4 py-2 text-white transition-colors hover:bg-gray-800"
        >
          Open Google Cloud Console
        </a>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col gap-2 lg:flex-row">
      <div className={`flex min-h-0 w-full flex-col lg:w-[30%] lg:flex-none ${isMobile && view === 'map' ? 'shrink-0' : 'flex-1'}`}>
        <div className="mb-2 shrink-0 bg-white p-1 md:p-2">
          <div className="flex gap-2">
            <TypingSearchInput
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                setSelectedSupplier(null);
              }}
              placeholder="Find all Suppliers and Materials."
              clearLabel="Clear search"
              inputClassName="h-10 w-full rounded-md border-2 border-red-500 bg-white pl-10 pr-8 text-base text-black placeholder:text-base focus:border-red-600 focus:outline-none md:placeholder:text-xs"
            />
          </div>
        </div>
        <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-1 ${isMobile && view === 'map' ? 'hidden' : ''} ${isMobile ? 'pb-28' : ''}`}>
          {filteredSuppliers.length === 0 ? (
            <div className="flex w-full items-center justify-center py-12 text-center">
              <p className="text-lg text-gray-600">
                {searchTerm ? `No suppliers found matching "${searchTerm}"` : 'No suppliers found'}
              </p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                isSelected={selectedSupplier === supplier.id}
                isListMode={isMobile && view === 'list'}
                onClick={() => setSelectedSupplier(selectedSupplier === supplier.id ? null : supplier.id)}
                onHoverChange={(hovered) => (hovered ? hoverSupplier(supplier.id) : clearSupplierHover(supplier.id))}
              />
            ))
          )}
        </div>
      </div>

      <div className={`${isMobile ? (view === 'map' ? 'relative min-h-0 w-full flex-1' : 'hidden') : 'relative min-h-0 flex-1 lg:w-[70%] lg:flex-none'}`}>
        {selectedSupplier !== null && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-20 left-4 z-20"
            onClick={() => setSelectedSupplier(null)}
          >
            Clear Selection
          </Button>
        )}
        {mapFailed || !apiKey ? (
          renderMapError()
        ) : showMapPane && mapReady ? (
          <SuppliersMap
            apiKey={apiKey}
            suppliers={filteredSuppliers}
            selectedId={selectedSupplier}
            hoveredId={hoveredSupplier}
            onSelect={setSelectedSupplier}
            onHover={hoverSupplier}
            onHoverEnd={clearSupplierHover}
            onError={() => setMapFailed(true)}
          />
        ) : showMapPane ? (
          <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-black bg-gray-50 text-sm text-gray-600">
            Loading map…
          </div>
        ) : null}
      </div>
      {isMobile ? (
        <ViewToggle
          currentView={view === 'map' ? 'map' : 'list'}
          onViewChange={setView}
          views={['list', 'map']}
          hideBackgroundToggle
        />
      ) : null}
    </div>
  );
}
