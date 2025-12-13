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
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categoryClasses = (categoryLabel: string) => {
    // Base classes: same as PagesMenu, with whitespace-nowrap and shrink-0 for horizontal scrolling
    const baseClasses = 'group h-10 rounded-full border-2 transition-all duration-300 font-medium flex items-center justify-center px-2 md:px-4 gap-1 whitespace-nowrap shrink-0 cursor-pointer hover:scale-110';
    // Active item: same style as PagesMenu active item - bg-white border-2 border-black
    const activeClasses = 'bg-white border-black text-black';
    // Inactive item: same style as PagesMenu inactive item
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400';
    
    return activeCategory === categoryLabel 
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div className="w-full h-[60px] border-b border-black pt-2 pb-2 px-2 md:p-4 flex items-center">
      <div className="w-full flex items-center gap-3 overflow-x-auto py-0.5 scrollbar-custom">
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

