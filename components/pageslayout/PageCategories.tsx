'use client';

import { ReactNode, useState } from 'react';
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
};

const serviceCategories: CategoryItem[] = [
  { label: 'All', icon: Grid },
  { label: 'Landscape', icon: TreePine },
  { label: 'Pavers', icon: Square },
  { label: 'Tile', icon: Grid3x3 },
  { label: 'Roofing', icon: Home },
  { label: 'Plumbing', icon: Droplet },
  { label: 'Electrical', icon: Zap },
  { label: 'HVAC', icon: Wind },
  { label: 'Painting', icon: Paintbrush },
  { label: 'Flooring', icon: Layers },
  { label: 'Windows', icon: RectangleHorizontal },
  { label: 'Doors', icon: DoorOpen },
  { label: 'Fencing', icon: Fence },
  { label: 'Decking', icon: Layout },
];

export default function ServiceCategories({ children }: ServiceCategoriesProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categoryClasses = (categoryLabel: string) => {
    // Base classes: same as PagesMenu, with whitespace-nowrap and shrink-0 for horizontal scrolling
    const baseClasses = 'h-10 rounded-full border-2 transition-all font-medium flex items-center justify-center px-2 md:px-4 gap-1 whitespace-nowrap shrink-0 cursor-pointer';
    // Active item: same style as PagesMenu active item - bg-white border-2 border-black
    const activeClasses = 'bg-white border-black text-black';
    // Inactive item: same style as PagesMenu inactive item
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400';
    
    return activeCategory === categoryLabel 
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div className="w-full h-[60px] border-b border-black py-2 px-2 md:p-4 flex items-center">
      <div className="w-full flex items-center gap-3 overflow-x-auto scrollbar-hide py-0.5">
        {serviceCategories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.label}
              onClick={() => setActiveCategory(category.label)}
              className={categoryClasses(category.label)}
            >
              <Icon className="w-4 h-4" />
              {category.label}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

