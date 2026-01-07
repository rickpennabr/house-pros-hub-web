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
  Waves,
  Sun,
  Shield,
  Box,
  Wifi,
  Wrench
} from 'lucide-react';
import { ComponentType } from 'react';
import { GiGate } from 'react-icons/gi';

export interface CategoryItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}

export const SERVICE_CATEGORIES: CategoryItem[] = [
  { label: 'General Contractor', icon: Home, color: 'text-gray-700' },
  { label: 'Handyman', icon: Wrench, color: 'text-orange-600' },
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
  { label: 'Ornamental Iron', icon: GiGate as ComponentType<{ className?: string }>, color: 'text-slate-800' },
  { label: 'Decking', icon: Layout, color: 'text-orange-700' },
  { label: 'Carpentry', icon: Hammer, color: 'text-brown-700' },
  { label: 'Pools & Spas', icon: Waves, color: 'text-cyan-600' },
  { label: 'Solar', icon: Sun, color: 'text-yellow-600' },
  { label: 'Fire Protection', icon: Shield, color: 'text-red-700' },
];

export const ALL_CATEGORY: CategoryItem = { label: 'All', icon: Grid, color: 'text-black' };

export const CATEGORIES_WITH_ALL = [ALL_CATEGORY, ...SERVICE_CATEGORIES];
