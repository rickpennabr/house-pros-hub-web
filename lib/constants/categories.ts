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
  Layout,
  SquareStack,
  CircleDot,
  Building2,
  Umbrella,
  Sparkles,
  Hammer,
  Hand,
  Waves,
  Sun,
  Shield,
  Box,
  Wifi,
  Wrench,
  Droplets,
  Bug,
  ClipboardCheck,
  Truck,
  Trash2,
  Refrigerator,
  KeyRound
} from 'lucide-react';
import { ComponentType } from 'react';

export interface CategoryItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}

export const SERVICE_CATEGORIES: CategoryItem[] = [
  { label: 'General Contractor', icon: Home, color: 'text-gray-700' },
  { label: 'Handyman', icon: Hand, color: 'text-orange-600' },
  { label: 'Installer', icon: Wrench, color: 'text-slate-600' },
  { label: 'Landscape', icon: TreePine, color: 'text-green-600' },
  { label: 'Pavers', icon: Square, color: 'text-amber-700' },
  { label: 'Concrete', icon: Box, color: 'text-gray-600' },
  { label: 'Tile', icon: Grid3x3, color: 'text-slate-600' },
  { label: 'Masonry', icon: Square, color: 'text-stone-600' },
  { label: 'Roofing', icon: Home, color: 'text-red-600' },
  { label: 'Siding', icon: Layers, color: 'text-blue-700' },
  { label: 'Gutters', icon: Droplet, color: 'text-cyan-700' },
  { label: 'Garage Doors', icon: DoorOpen, color: 'text-slate-700' },
  { label: 'Plumbing', icon: Droplet, color: 'text-blue-500' },
  { label: 'Electrical', icon: Zap, color: 'text-yellow-500' },
  { label: 'Smart Home', icon: Wifi, color: 'text-indigo-500' },
  { label: 'HVAC', icon: Wind, color: 'text-cyan-500' },
  { label: 'Painting', icon: Paintbrush, color: 'text-purple-600' },
  { label: 'Flooring', icon: Layers, color: 'text-amber-800' },
  { label: 'Carpet', icon: SquareStack, color: 'text-indigo-600' },
  { label: 'Glass', icon: CircleDot, color: 'text-blue-300' },
  { label: 'Windows', icon: RectangleHorizontal, color: 'text-sky-400' },
  { label: 'Doors', icon: DoorOpen, color: 'text-amber-900' },
  { label: 'Windows & Doors', icon: Building2, color: 'text-teal-600' },
  { label: 'Patio Cover', icon: Umbrella, color: 'text-orange-500' },
  { label: 'Custom Outdoor Living', icon: Sparkles, color: 'text-pink-500' },
  { label: 'Fencing', icon: Fence, color: 'text-gray-600' },
  { label: 'Ornamental Iron', icon: Fence, color: 'text-slate-800' },
  { label: 'Decking', icon: Layout, color: 'text-orange-700' },
  { label: 'Carpentry', icon: Hammer, color: 'text-brown-700' },
  { label: 'Pools & Spas', icon: Waves, color: 'text-cyan-600' },
  { label: 'Solar', icon: Sun, color: 'text-yellow-600' },
  { label: 'Fire Protection', icon: Shield, color: 'text-red-700' },
  // Home services
  { label: 'Insulation', icon: Layers, color: 'text-pink-600' },
  { label: 'Drywall', icon: Square, color: 'text-stone-500' },
  { label: 'Countertops', icon: Square, color: 'text-zinc-600' },
  { label: 'Interior Design', icon: Sparkles, color: 'text-fuchsia-600' },
  { label: 'Lawn Care', icon: TreePine, color: 'text-lime-600' },
  { label: 'Tree Service', icon: TreePine, color: 'text-emerald-700' },
  { label: 'House Cleaning', icon: Sparkles, color: 'text-pink-500' },
  { label: 'Carpet Cleaning', icon: SquareStack, color: 'text-violet-600' },
  { label: 'Window Cleaning', icon: RectangleHorizontal, color: 'text-sky-500' },
  { label: 'Pressure Washing', icon: Droplets, color: 'text-blue-600' },
  { label: 'Air Duct Cleaning', icon: Wind, color: 'text-teal-600' },
  { label: 'Pool Service', icon: Waves, color: 'text-cyan-500' },
  { label: 'Pest Control', icon: Bug, color: 'text-lime-700' },
  { label: 'Home Inspection', icon: ClipboardCheck, color: 'text-indigo-600' },
  { label: 'Moving', icon: Truck, color: 'text-orange-600' },
  { label: 'Junk Removal', icon: Trash2, color: 'text-stone-600' },
  { label: 'Appliance Repair', icon: Refrigerator, color: 'text-sky-600' },
  { label: 'Locksmith', icon: KeyRound, color: 'text-amber-600' },
];

export const ALL_CATEGORY: CategoryItem = { label: 'All', icon: Grid, color: 'text-black' };

export const CATEGORIES_WITH_ALL = [ALL_CATEGORY, ...SERVICE_CATEGORIES];

const DEFAULT_CATEGORY_ITEM: CategoryItem = { label: '', icon: Wrench, color: 'text-gray-600' };

/**
 * Return CategoryItem for a label; use SERVICE_CATEGORIES when there's an exact match,
 * otherwise return a default icon for unknown labels.
 */
export function getCategoryItemForLabel(label: string): CategoryItem {
  if (!label) return DEFAULT_CATEGORY_ITEM;
  const found = SERVICE_CATEGORIES.find((c) => c.label === label);
  return found ? found : { ...DEFAULT_CATEGORY_ITEM, label };
}
