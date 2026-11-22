import { BrickWall, Layers, LayoutGrid, Package, PaintBucket, Ruler, Scroll } from 'lucide-react';
import {
  BoulderIcon,
  DecorativeRockIcon,
  FlagstoneIcon,
  HardscapeIcon,
  PlantsIcon,
  SoilIcon,
  type AppIcon,
} from '@/components/icons/hub';

/** Icon for each catalog item type (the filter chips on the ProTrades databases). */
const KIND_ICONS: Record<string, AppIcon> = {
  plant: PlantsIcon,
  rock: DecorativeRockIcon,
  boulder: BoulderIcon,
  soil: SoilIcon,
  sand: SoilIcon,
  flagstone: FlagstoneIcon,
  paver: HardscapeIcon,
  wall_block: BrickWall,
  base: Layers,
  edging: Ruler,
  fabric: Scroll,
  sealer: PaintBucket,
  other: Package,
};

/** kind = '' is the "All" chip. */
export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = kind ? KIND_ICONS[kind] ?? Package : LayoutGrid;
  return <Icon className={className} />;
}
