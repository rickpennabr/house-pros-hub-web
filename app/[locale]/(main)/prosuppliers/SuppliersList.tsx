'use client';

/// <reference types="@types/google.maps" />

import { useState, useEffect, useMemo } from 'react';
import { Search, Map, Filter, AlertCircle, List } from 'lucide-react';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import SupplierCard, { Supplier } from './SupplierCard';
import { Button } from '@/components/ui/Button';
import SupplierFilterModal from './SupplierFilterModal';
import type { ViewType } from '@/components/pageslayout/ViewToggle';
import { LuIdCard } from 'react-icons/lu';
import { useCategory } from '@/contexts/CategoryContext';

type SupplierViewType = ViewType | 'map';

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

// Mapping of trades to their typical materials
const TRADE_TO_MATERIALS: Record<string, string[]> = {
  'All': [],
  'Pavers': ['Pavers', 'Base Materials', 'Sand', 'Retaining Walls', 'Outdoor Living'],
  'Landscape': ['Base Materials', 'Sand', 'Rock', 'Boulders', 'Decorative Rocks', 'Bedrock', 'Aggregates'],
  'Tile': ['Travertine', 'Porcelain', 'Natural Stone'],
  'General': ['Tools', 'Concrete', 'Cement', 'Masonry Tools'],
  'Roofing': ['Tools'],
  'Plumbing': ['Tools'],
  'Electrical': ['Tools'],
  'HVAC': ['Tools'],
  'Painting': ['Tools', 'Sealers', 'Cleaners'],
  'Flooring': ['Travertine', 'Porcelain', 'Natural Stone', 'Tools'],
  'Windows': ['Tools'],
  'Doors': ['Tools'],
  'Fencing': ['Tools', 'Fencing Materials'],
  'Decking': ['Tools', 'Decking Materials'],
};

// Helper function to map supplier type to trade
const mapSupplierTypeToTrade = (type: string): string => {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('paver')) return 'Pavers';
  if (typeLower.includes('landscape')) return 'Landscape';
  if (typeLower.includes('stone') || typeLower.includes('travertine') || typeLower.includes('porcelain')) return 'Tile';
  if (typeLower.includes('concrete') || typeLower.includes('masonry')) return 'General';
  if (typeLower.includes('base material')) return 'Landscape';
  if (typeLower.includes('boulder')) return 'Landscape';
  if (typeLower.includes('rock')) return 'Landscape';
  if (typeLower.includes('bedrock')) return 'Landscape';
  return 'General';
};

export default function SuppliersList() {
  const { searchQuery } = useCategory();
  const [selectedTrade, setSelectedTrade] = useState('All');
  const [selectedMaterial, setSelectedMaterial] = useState('All Materials');
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<SupplierViewType>('list');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Combine ExpandableSearchbar search query with local search term
  const combinedSearchTerm = searchQuery || searchTerm;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
  });

  // Enhanced error logging
  useEffect(() => {
    if (!apiKey) {
      console.error('❌ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set in environment variables');
      console.info('ℹ️ Add it to your .env.local file');
    } else {
      console.log('✓ Google Maps API Key is configured');
    }
    
    if (loadError) {
      console.error('❌ Google Maps Load Error:', loadError);
    }
    
    if (isLoaded) {
      console.log('✓ Google Maps loaded successfully');
    }
  }, [loadError, apiKey, isLoaded]);

  const markerIcon = useMemo<google.maps.Symbol | null>(() => {
    if (typeof window === 'undefined' || !isLoaded) return null;

    const googleMaps = (window as { google?: { maps?: typeof google.maps } }).google?.maps;
    const circlePath = googleMaps?.SymbolPath?.CIRCLE;
    if (!circlePath) return null;

    return {
      path: circlePath,
      fillColor: 'black',
      fillOpacity: 1,
      strokeWeight: 0,
      scale: 8,
    } as google.maps.Symbol;
  }, [isLoaded]);

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

  // Listen for filter button click from PageCategories
  useEffect(() => {
    const handleOpenFilter = () => {
      setIsFilterModalOpen(true);
    };

    window.addEventListener('openSuppliersFilter', handleOpenFilter);
    return () => {
      window.removeEventListener('openSuppliersFilter', handleOpenFilter);
    };
  }, []);

  // Get available materials based on selected trade
  const availableMaterials = useMemo(() => {
    if (selectedTrade === 'All') {
      const allMaterials = new Set<string>();
      suppliers.forEach(supplier => {
        supplier.materials.forEach(material => allMaterials.add(material));
      });
      return Array.from(allMaterials).sort();
    }
    return TRADE_TO_MATERIALS[selectedTrade] || [];
  }, [selectedTrade]);

  // Filter suppliers based on trade, material, and search term
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      if (selectedTrade !== 'All') {
        const supplierTrade = mapSupplierTypeToTrade(supplier.type);
        if (supplierTrade !== selectedTrade) {
          return false;
        }
      }

      if (selectedMaterial !== 'All Materials') {
        if (!supplier.materials.includes(selectedMaterial)) {
          return false;
        }
      }

      const searchLower = combinedSearchTerm.toLowerCase();
      const supplierTrade = mapSupplierTypeToTrade(supplier.type);
      const matchesSearch =
        supplier.name.toLowerCase().includes(searchLower) ||
        supplier.type.toLowerCase().includes(searchLower) ||
        supplierTrade.toLowerCase().includes(searchLower) ||
        supplier.materials.some((material) => material.toLowerCase().includes(searchLower));

      if (!matchesSearch) {
        return false;
      }

      if (selectedSupplier !== null && supplier.id !== selectedSupplier) {
        return false;
      }

      return true;
    });
  }, [selectedTrade, selectedMaterial, combinedSearchTerm, selectedSupplier]);

  const mapCenter = {
    lat: 36.0922,
    lng: -115.1987,
  };

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
  };

  const renderSearchBar = () => (
    <div className="mb-4 flex flex-row gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 border-2 border-black rounded-lg bg-white focus:outline-none transition-all text-black placeholder-gray-500"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 pointer-events-none" size={20} />
      </div>
      <button
        onClick={() => setIsFilterModalOpen(true)}
        className="h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors shrink-0"
        aria-label="Filter"
      >
        <Filter className="w-5 h-5 text-white" />
      </button>
    </div>
  );

  const renderPCSidebarHeader = () => (
    <div className="mb-2">
      <h2 className="text-2xl font-bold text-black">Suppliers</h2>
    </div>
  );

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

  const [showSearchInput, setShowSearchInput] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row gap-2 relative min-h-[calc(100vh-200px)]">
      {/* List Sidebar */}
      <div className={`lg:w-[35%] ${view === 'map' && isMobile ? 'hidden' : 'block'}`}>
        {/* Mobile: Show full search bar, PC: Show header with Suppliers label and search button */}
        {isMobile ? (
          renderSearchBar()
        ) : (
          <>
            {renderPCSidebarHeader()}
            {(showSearchInput || searchTerm) && (
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search suppliers..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value === '') {
                        setShowSearchInput(false);
                      }
                    }}
                    onBlur={(e) => {
                      // Keep input open if there's a search term
                      if (e.target.value === '') {
                        setShowSearchInput(false);
                      }
                    }}
                    className="w-full h-10 pl-10 pr-4 border-2 border-black rounded-lg bg-white focus:outline-none transition-all text-black placeholder-gray-500"
                    autoFocus
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 pointer-events-none" size={20} />
                </div>
              </div>
            )}
          </>
        )}
        <div className={`${isMobile && view === 'list' ? 'space-y-2' : 'space-y-4'} overflow-y-auto max-h-[calc(100vh-280px)]`}>
          {filteredSuppliers.length === 0 ? (
            <div className="w-full flex items-center justify-center py-12 text-center">
              <p className="text-gray-600 text-lg">
                {combinedSearchTerm
                  ? `No suppliers found matching "${combinedSearchTerm}"`
                  : 'No suppliers found with the selected material'}
              </p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                isSelected={selectedSupplier === supplier.id}
                onClick={() => setSelectedSupplier(selectedSupplier === supplier.id ? null : supplier.id)}
                isListMode={isMobile && view === 'list'}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Map Side */}
      <div className={`lg:w-[65%] h-[calc(100vh-200px)] ${view === 'list' && isMobile ? 'hidden' : 'block'} relative`}>
        {/* Search bar overlay on map (mobile only) */}
        {view === 'map' && isMobile && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 p-4 border-2 border-black rounded-lg mb-4">
            <div className="flex flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 border-2 border-black rounded-lg bg-white focus:outline-none transition-all text-black placeholder-gray-500"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 pointer-events-none" size={20} />
              </div>
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors shrink-0"
                aria-label="Filter"
              >
                <Filter className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        )}
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
        {loadError || !apiKey ? (
          renderMapError()
        ) : isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={
              selectedSupplier !== null
                ? suppliers.find((s) => s.id === selectedSupplier)?.coordinates || mapCenter
                : mapCenter
            }
            zoom={selectedSupplier !== null ? 15 : 11}
          >
            {filteredSuppliers.map((supplier) => {
              if (!supplier.coordinates) return null;
              return (
                <Marker
                  key={supplier.id}
                  position={supplier.coordinates}
                  onClick={() => setSelectedSupplier(supplier.id)}
                  icon={markerIcon || undefined}
                />
              );
            })}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex items-center justify-center border-2 border-black rounded-lg bg-gray-50">
            <div className="text-center">
              <Map className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h2 className="text-2xl font-bold text-black mb-2">Loading Map...</h2>
              <p className="text-gray-600">Please wait...</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <SupplierFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        selectedTrade={selectedTrade}
        selectedMaterial={selectedMaterial}
        onTradeChange={setSelectedTrade}
        onMaterialChange={setSelectedMaterial}
        availableMaterials={availableMaterials}
      />

      {/* View Toggle - Mobile only (card/list/map all inside the same black container) */}
      {isMobile && filteredSuppliers.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 bottom-[90px] md:bottom-[75px]">
          <div className="p-2 bg-black text-white rounded-lg border-2 border-black font-bold text-[11px] flex items-center justify-center gap-2 shadow-lg">
            <button
              type="button"
              onClick={() => setView('card')}
              className={`flex items-center gap-2 p-1 md:px-2 md:py-1.5 rounded transition-all duration-200 active:scale-95 ${
                view === 'card' ? 'bg-white text-black' : 'hover:bg-gray-800 text-white'
              }`}
              aria-label="Card view"
            >
              <LuIdCard className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={() => setView('list')}
              className={`flex items-center gap-2 p-1 md:px-2 md:py-1.5 rounded transition-all duration-200 active:scale-95 ${
                view === 'list' ? 'bg-white text-black' : 'hover:bg-gray-800 text-white'
              }`}
              aria-label="List view"
            >
              <List className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setView('map')}
              className={`flex items-center gap-2 p-1 md:px-2 md:py-1.5 rounded transition-all duration-200 active:scale-95 ${
                view === 'map' ? 'bg-white text-black' : 'hover:bg-gray-800 text-white'
              }`}
              aria-label="Map view"
            >
              <Map className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}