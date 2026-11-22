import { HubIcon, type HubIconProps } from './HubIcon';

/** House Pros trade colors: green, orange, blue, red (one per tile, in slot order). */
export const PROTRADES_TILE_COLORS = ['#15803d', '#c2410c', '#1d4ed8', '#dc2626'] as const;

/** Docked tiles in fill order: top left, bottom left, bottom right. The loose tile is the 4th slot. */
const SLOTS = [
  { x: 3, y: 3 },
  { x: 3, y: 13 },
  { x: 13, y: 13 },
] as const;

/**
 * ProTrades: trade modules snapped together, with one more tile plugging in.
 *
 * - `colors`: one CSS color per slot (3 docked tiles, then the loose tile). Defaults to green, orange, blue, red.
 * - `on`: which slots are "on" (a trade the pro turned on). On tiles are filled; off tiles are outlined with a light tint.
 *   Leave it out to show every tile filled.
 *
 * Hover: the tiles pop one after another, then the loose tile lifts, swings in and snaps into place.
 */
export function ProTradesIcon({
  colors = [...PROTRADES_TILE_COLORS],
  on,
  ...props
}: HubIconProps & { colors?: string[]; on?: boolean[] }) {
  const tile = (index: number) => {
    const color = colors[index] ?? 'currentColor';
    const filled = on ? on[index] === true : true;
    return { stroke: color, fill: color, fillOpacity: filled ? 0.85 : 0.14 };
  };
  return (
    <HubIcon {...props}>
      {SLOTS.map((slot, index) => (
        <g key={index} className={`hub-anim-tile hub-tile-${index + 1}`}>
          <rect x={slot.x} y={slot.y} width="8" height="8" rx="1.6" {...tile(index)} />
        </g>
      ))}
      <g className="hub-anim-plug">
        <rect x="13" y="3" width="8" height="8" rx="1.6" transform="rotate(14 17 7) translate(1.2 -1.2)" {...tile(3)} />
      </g>
    </HubIcon>
  );
}
