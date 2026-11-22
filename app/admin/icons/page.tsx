'use client';

import { BoulderIcon, DecorativeRockIcon, FlagstoneIcon, SoilIcon, HardscapeIcon, LandscapeIcon, MaintenanceIcon, PlantsIcon, ProTradesIcon, type AppIcon } from '@/components/icons/hub';

function ProTradesAllIcon({ className }: { className?: string }) {
  return <ProTradesIcon className={className} />;
}

const ICONS: { name: string; file: string; icon: AppIcon; meaning: string; motion: string; color: string }[] = [
  {
    name: 'ProTradesIcon',
    file: 'components/icons/hub/ProTradesIcon.tsx',
    icon: ProTradesAllIcon,
    meaning: 'ProTrades: trade modules snapped together, one more plugging in. Tiles are green, orange, blue and red (Landscape, Hardscape, then the next trades). In the CRM menu, trades a pro turned on are filled, the rest are outlined.',
    motion: 'Tiles pop one after another, then the loose tile swings in and snaps.',
    color: 'text-red-600',
  },
  {
    name: 'LandscapeIcon',
    file: 'components/icons/hub/LandscapeIcon.tsx',
    icon: LandscapeIcon,
    meaning: 'Landscape trade: a yard with a tree, a shrub and the sun.',
    motion: 'Tree sways, sun rays turn.',
    color: 'text-green-700',
  },
  {
    name: 'HardscapeIcon',
    file: 'components/icons/hub/HardscapeIcon.tsx',
    icon: HardscapeIcon,
    meaning: 'Hardscape trade: pavers in a running bond, the center paver being set.',
    motion: 'The center paver lifts and drops into place; the rows settle.',
    color: 'text-orange-700',
  },
  {
    name: 'PlantsIcon',
    file: 'components/icons/hub/PlantsIcon.tsx',
    icon: PlantsIcon,
    meaning: 'Plants database: a pineapple (date) palm with the diamond trunk.',
    motion: 'Fronds sway in the wind.',
    color: 'text-green-700',
  },
  {
    name: 'MaintenanceIcon',
    file: 'components/icons/hub/MaintenanceIcon.tsx',
    icon: MaintenanceIcon,
    meaning: 'Landscape maintenance: a stick man with a backpack leaf blower.',
    motion: 'Air puffs from the nozzle, the leaf blows away.',
    color: 'text-green-700',
  },
  {
    name: 'DecorativeRockIcon',
    file: 'components/icons/hub/DecorativeRockIcon.tsx',
    icon: DecorativeRockIcon,
    meaning: 'Decorative rock: a pile of landscape rock.',
    motion: 'The top stone hops and lands back on the pile.',
    color: 'text-orange-700',
  },
  {
    name: 'BoulderIcon',
    file: 'components/icons/hub/BoulderIcon.tsx',
    icon: BoulderIcon,
    meaning: 'Boulders: one big rock with a crack, on the ground.',
    motion: 'The boulder rocks side to side on its base.',
    color: 'text-orange-700',
  },
  {
    name: 'SoilIcon',
    file: 'components/icons/hub/SoilIcon.tsx',
    icon: SoilIcon,
    meaning: 'Sand, soil & gravel: a mound with grains pouring onto it.',
    motion: 'Grains keep falling onto the pile.',
    color: 'text-orange-700',
  },
  {
    name: 'FlagstoneIcon',
    file: 'components/icons/hub/FlagstoneIcon.tsx',
    icon: FlagstoneIcon,
    meaning: 'Flagstone: irregular stone slabs laid as a patio.',
    motion: 'The slabs set one after another.',
    color: 'text-orange-700',
  },
];

/** Gallery of House Pros icons. Hover a card to play its motion. */
export default function AdminIconsPage() {
  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold">Icons</h1>
        <p className="text-sm text-gray-600">
          Our own icons (components/icons/hub). Same line style as the other icons, with a small motion on hover. Hover a card to play it.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ICONS.map(({ name, file, icon: Icon, meaning, motion, color }) => (
          <div key={name} className="group rounded-lg border-2 border-black bg-white p-4">
            <div className="flex items-end gap-5">
              <Icon className={`h-16 w-16 ${color}`} />
              <Icon className={`h-8 w-8 ${color}`} />
              <Icon className={`h-5 w-5 ${color}`} />
              <Icon className="h-5 w-5 text-red-600" />
              <Icon className="h-4 w-4 text-black" />
            </div>
            {name === 'ProTradesIcon' ? (
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
                {[0, 1, 2].map((count) => (
                  <span key={count} className="flex items-center gap-1.5">
                    <ProTradesIcon className="h-6 w-6" on={[0, 1, 2, 3].map((slot) => slot < count)} />
                    {count} on
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-4 font-mono text-sm font-semibold">{name}</p>
            <p className="mt-1 text-sm">{meaning}</p>
            <p className="mt-1 text-sm text-gray-600">Hover: {motion}</p>
            <p className="mt-2 font-mono text-xs text-gray-500">{file}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
