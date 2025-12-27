'use client';

import { Filter } from 'lucide-react';
import { SERVICE_CATEGORIES } from '@/lib/constants/categories';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';

interface SupplierFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrade: string;
  selectedMaterial: string;
  onTradeChange: (trade: string) => void;
  onMaterialChange: (material: string) => void;
  availableMaterials: string[];
}


export default function SupplierFilterModal({
  isOpen,
  onClose,
  selectedTrade,
  selectedMaterial,
  onTradeChange,
  onMaterialChange,
  availableMaterials,
}: SupplierFilterModalProps) {

  const handleTradeChange = (trade: string) => {
    onTradeChange(trade);
    // Reset material selection when trade changes
    onMaterialChange('All Materials');
  };

  const handleClearFilters = () => {
    onTradeChange('All');
    onMaterialChange('All Materials');
  };

  const hasActiveFilters = selectedTrade !== 'All' || selectedMaterial !== 'All Materials';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Filter className="w-6 h-6 text-black" />
          <span>Filter Suppliers</span>
        </div>
      }
      showHeader={true}
      maxWidth="md"
    >

        {/* Filter Content */}
        <div className="flex-1 p-4 space-y-6">
          {/* Trade Filter */}
          <div>
            <label htmlFor="trade-filter" className="block text-base font-bold text-black mb-2">
              Trade
            </label>
            <Select
              id="trade-filter"
              value={selectedTrade}
              onChange={(e) => handleTradeChange(e.target.value)}
            >
              <option value="All">All Trades</option>
              {SERVICE_CATEGORIES.map((category) => (
                <option key={category.label} value={category.label}>
                  {category.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Material Filter */}
          <div>
            <label htmlFor="material-filter" className="block text-base font-bold text-black mb-2">
              Material Type
            </label>
            <Select
              id="material-filter"
              value={selectedMaterial}
              onChange={(e) => onMaterialChange(e.target.value)}
              disabled={availableMaterials.length === 0}
            >
              <option value="All Materials">All Materials</option>
              {availableMaterials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </Select>
            {selectedTrade !== 'All' && availableMaterials.length === 0 && (
              <p className="text-sm text-gray-600 mt-2">No materials available for this trade</p>
            )}
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="w-full px-4 py-2.5 border-2 border-black rounded-lg bg-white hover:bg-gray-50 transition-colors font-medium text-black"
            >
              Clear Filters
            </button>
          )}
        </div>
    </Modal>
  );
}

