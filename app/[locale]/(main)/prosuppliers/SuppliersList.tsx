'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, AlertCircle, X } from 'lucide-react';
import SupplierCard, { type Supplier } from './SupplierCard';
import SuppliersMap from './SuppliersMap';
import { loadSuppliers } from '@/lib/data/suppliers';
import { Button } from '@/components/ui/Button';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';

export default function SuppliersList() {
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [hoveredSupplier, setHoveredSupplier] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<ViewType>('list');
  const [isMobile, setIsMobile] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

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
    if (!apiKey) {
      console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set in environment variables');
    }
  }, [apiKey]);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

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

  const renderMapError = () => (
    <div className="w-full h-full flex items-center justify-center border-2 border-black rounded-lg bg-gray-50">
      <div className="text-center max-w-md px-4">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold text-black mb-2">Map Configuration Error</h2>
        {!apiKey ? (
          <>
            <p className="text-gray-700 mb-4">
              Google Maps API key is missing. Please configure it in your environment variables.
            </p>
            <div className="text-sm text-gray-600 text-left space-y-2 mb-4 bg-gray-100 p-4 rounded">
              <p className="font-semibold">Setup Steps:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Create a project in Google Cloud Console</li>
                <li>Enable <strong>Maps JavaScript API</strong></li>
                <li>Enable <strong>Billing</strong> (required by Google)</li>
                <li>Create an API key</li>
                <li>Add to <code className="bg-white px-1 rounded">.env.local</code>:
                  <div className="bg-white p-2 rounded mt-1 font-mono text-xs">
                    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
                  </div>
                </li>
                <li>Restart your dev server</li>
              </ol>
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-700 mb-4">
              There was an error loading Google Maps. This usually means:
            </p>
            <div className="text-sm text-gray-600 text-left space-y-2 mb-4 bg-gray-100 p-4 rounded">
              <p className="font-semibold">Common issues:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li><strong>Maps JavaScript API</strong> not enabled</li>
                <li><strong>Billing</strong> not set up on your Google Cloud project</li>
                <li>API key is invalid or expired</li>
                <li>API key restrictions block your domain</li>
                <li><strong>RefererNotAllowedMapError</strong> on mobile or LAN: add your URL (e.g. <code>http://192.168.0.26:3000/*</code>) under API key → Application restrictions → HTTP referrers</li>
                <li>You've exceeded your quota</li>
              </ol>
              <p className="text-xs text-gray-500 mt-3">
                Check the browser console for the specific error message
              </p>
            </div>
          </>
        )}
        <a
          href="https://console.cloud.google.com/google/maps-apis"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
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
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500" />
              <input
                type="text"
                placeholder="Find all Suppliers and Materials."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSelectedSupplier(null);
                }}
                className="h-10 w-full rounded-md border-2 border-red-500 bg-white pl-8 pr-8 text-base text-black placeholder:text-base focus:border-red-600 focus:outline-none md:placeholder:text-xs"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedSupplier(null);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-1 ${isMobile && view === 'map' ? 'hidden' : ''} ${isMobile ? 'pb-28' : ''}`}>
          {suppliersLoading ? (
            <div className="flex w-full items-center justify-center py-12 text-center">
              <p className="text-lg text-gray-600">Loading suppliers...</p>
            </div>
          ) : suppliersError ? (
            <div className="flex w-full items-center justify-center py-12 text-center">
              <p className="text-lg text-gray-600">{suppliersError}</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
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
        {/* Search bar overlay on map removed on mobile - using top navigation instead */}
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
        ) : !isMobile || view === 'map' ? (
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