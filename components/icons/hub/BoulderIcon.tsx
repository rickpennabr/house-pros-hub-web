import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Boulder: a big faceted landscape boulder with a small rock beside it, on the ground.
 * Hover: the boulder rocks side to side on its base.
 */
export function BoulderIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      <path d="M2.5 20.5h19" />
      <path d="M18.4 20.5l.4-2.2 1.9-.8 1.2 1.4-.3 1.6" />
      <g className="hub-anim-boulder">
        <path d="M10.1 13.5l6.7-2.9.9 5.3-1.6 4.6H8.5z" fill="currentColor" fillOpacity={0.2} stroke="none" />
        <path d="M3.5 20.5l.9-6.4 3.4-5.2 5.4-1.4 3.6 3.1.9 5.3-1.6 4.6" />
        <path d="M7.8 8.9l2.3 4.6-1.6 7M10.1 13.5l6.7-2.9" />
      </g>
    </HubIcon>
  );
}
