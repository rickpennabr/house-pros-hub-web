'use client';

import { ReactNode, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useCategory } from '@/contexts/CategoryContext';
import ExpandableSearchbar from './ExpandableSearchbar';
import { 
  Grid, 
  TreePine, 
  Square, 
  Grid3x3, 
  Home, 
  Droplet, 
  Zap, 
  Wind, 
  Paintbrush, 
  Layers, 
  RectangleHorizontal, 
  DoorOpen,
  Fence,
  Layout
} from 'lucide-react';

interface ServiceCategoriesProps {
  children?: ReactNode;
}

type CategoryItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const serviceCategories: CategoryItem[] = [
  { label: 'All', icon: Grid, color: 'text-black' },
  { label: 'Landscape', icon: TreePine, color: 'text-green-600' },
  { label: 'Pavers', icon: Square, color: 'text-amber-700' },
  { label: 'Tile', icon: Grid3x3, color: 'text-slate-600' },
  { label: 'Roofing', icon: Home, color: 'text-red-600' },
  { label: 'Plumbing', icon: Droplet, color: 'text-blue-500' },
  { label: 'Electrical', icon: Zap, color: 'text-yellow-500' },
  { label: 'HVAC', icon: Wind, color: 'text-cyan-500' },
  { label: 'Painting', icon: Paintbrush, color: 'text-purple-600' },
  { label: 'Flooring', icon: Layers, color: 'text-amber-800' },
  { label: 'Windows', icon: RectangleHorizontal, color: 'text-sky-400' },
  { label: 'Doors', icon: DoorOpen, color: 'text-amber-900' },
  { label: 'Fencing', icon: Fence, color: 'text-gray-600' },
  { label: 'Decking', icon: Layout, color: 'text-orange-700' },
];

export default function ServiceCategories({ children }: ServiceCategoriesProps) {
  const { activeCategory, setActiveCategory, setSearchQuery } = useCategory();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { getThemeClasses } = useTheme();
  const categoriesClass = getThemeClasses('categories');

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchToggle = (isOpen: boolean) => {
    setIsSearchOpen(isOpen);
    if (!isOpen) {
      setSearchQuery(''); // Clear search when closing
    }
  };

  const categoryClasses = (categoryLabel: string) => {
    // Base classes: same as PagesMenu, with whitespace-nowrap and shrink-0 for horizontal scrolling
    const baseClasses = 'group h-10 border-2 transition-all duration-300 font-medium flex items-center justify-center px-1.5 md:px-2 gap-2 whitespace-nowrap shrink-0 cursor-pointer hover:scale-110';
    // Active item: always use black border (not theme-aware)
    const activeClasses = 'bg-white border-black text-black rounded-lg';
    // Inactive item: use rounded-lg to match active shape, including on hover
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400 rounded-lg';
    
    return activeCategory === categoryLabel 
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div className={`w-full h-[60px] ${categoriesClass} pt-2 pb-2 px-1 md:px-2 md:py-4 flex items-center relative overflow-hidden`}>
      {/* Search Component */}
      <ExpandableSearchbar 
        onSearchChange={handleSearchChange}
        onSearchToggle={handleSearchToggle}
        placeholder="Search businesses, services, or keywords..."
      />

      {/* Categories - Hidden when search is open */}
      <div className={`w-full flex items-center gap-3 overflow-x-auto scrollbar-custom transition-opacity duration-300 ${
        isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        {serviceCategories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.label}
              onClick={() => setActiveCategory(category.label)}
              className={categoryClasses(category.label)}
            >
              <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-125 ${category.color}`} />
              {category.label}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

