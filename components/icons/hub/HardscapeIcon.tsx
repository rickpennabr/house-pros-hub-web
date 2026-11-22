import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Hardscape: pavers laid in a running bond, the center paver being set.
 * Hover: the center paver lifts and drops into place, and the rows settle.
 */
export function HardscapeIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      <g className="hub-anim-settle">
        <rect x="3" y="3.5" width="8.4" height="5" rx="1" />
        <rect x="12.6" y="3.5" width="8.4" height="5" rx="1" />
        <rect x="3" y="10" width="3.6" height="5" rx="1" />
        <rect x="17.4" y="10" width="3.6" height="5" rx="1" />
        <rect x="3" y="16.5" width="8.4" height="5" rx="1" />
        <rect x="12.6" y="16.5" width="8.4" height="5" rx="1" />
      </g>
      <g className="hub-anim-paver">
        <rect x="7.8" y="10" width="8.4" height="5" rx="1" fill="currentColor" fillOpacity={0.2} />
      </g>
    </HubIcon>
  );
}
