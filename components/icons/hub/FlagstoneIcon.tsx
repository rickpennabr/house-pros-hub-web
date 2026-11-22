import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Flagstone: irregular natural stone slabs laid as a patio.
 * Hover: the slabs set one after another.
 */
export function FlagstoneIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      <g className="hub-anim-slab hub-anim-slab-1">
        <path d="M3.5 6.5L9 4.2l2.3 4.1-2.4 3-4.8-.8z" />
      </g>
      <g className="hub-anim-slab hub-anim-slab-2">
        <path d="M13.2 3.8l6.9 1.1.6 5.3-5.5 1.1-2.6-3.1z" fill="currentColor" fillOpacity={0.2} />
      </g>
      <g className="hub-anim-slab hub-anim-slab-3">
        <path d="M4.6 13.7l6.6-1 2.5 4-2.9 4.1-5.6-.9-1.4-3.6z" />
      </g>
      <g className="hub-anim-slab hub-anim-slab-4">
        <path d="M16 13l4.6.5-.5 5.6-4.6.5-.8-3.5z" />
      </g>
    </HubIcon>
  );
}
