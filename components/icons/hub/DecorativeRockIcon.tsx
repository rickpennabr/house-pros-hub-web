import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Decorative rock: a pile of landscape rock.
 * Hover: the top stone hops and lands back on the pile.
 */
export function DecorativeRockIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      <ellipse cx="6.4" cy="18.4" rx="3" ry="2.3" />
      <ellipse cx="12" cy="18.8" rx="2.9" ry="2" />
      <ellipse cx="17.6" cy="18.4" rx="3" ry="2.3" />
      <ellipse cx="9.2" cy="14.2" rx="2.7" ry="2" />
      <ellipse cx="14.8" cy="14.2" rx="2.7" ry="2" />
      <g className="hub-anim-pebble">
        <ellipse cx="12" cy="9.9" rx="2.4" ry="1.9" fill="currentColor" fillOpacity={0.2} />
      </g>
    </HubIcon>
  );
}
