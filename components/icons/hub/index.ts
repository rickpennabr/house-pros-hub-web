/** House Pros icon system: our own icons with hover motion. See HubIcon.tsx for the rules. */
export { HubIcon, type HubIconProps } from './HubIcon';
export { LandscapeIcon } from './LandscapeIcon';
export { HardscapeIcon } from './HardscapeIcon';
export { PlantsIcon } from './PlantsIcon';
export { MaintenanceIcon } from './MaintenanceIcon';
export { ProTradesIcon, PROTRADES_TILE_COLORS } from './ProTradesIcon';

import type { ComponentType } from 'react';
/** Any icon the app accepts: a lucide icon or one of ours. Both take className. */
export type AppIcon = ComponentType<{ className?: string }>;
export { DecorativeRockIcon } from './DecorativeRockIcon';
export { BoulderIcon } from './BoulderIcon';
export { SoilIcon } from './SoilIcon';
export { FlagstoneIcon } from './FlagstoneIcon';
