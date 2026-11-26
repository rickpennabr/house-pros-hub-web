import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Landscape maintenance: a stick man with a backpack leaf blower and leaves on the ground.
 * Hover: air puffs out of the nozzle and the leaves fly away, past the icon's edge.
 */
export function MaintenanceIcon(props: HubIconProps) {
  return (
    <HubIcon overflow="visible" {...props}>
      {/* Worker and blower in black; air and leaves keep the icon color (green). */}
      <g className="hub-man">
        {/* Worker */}
        <circle cx="8.6" cy="4.2" r="1.8" />
        <path d="M8.6 6.4v7.2M8.6 13.6l-2.4 6.9M8.6 13.6l2.5 6.9" />
        <path d="M8.6 8.6l3.4 2.6" />
        {/* Backpack blower and tube */}
        <rect x="3.4" y="6.8" width="3.6" height="5.4" rx="1" />
        <path d="M5.4 12.2c.8 1.4 3 1.6 5.4.4l6.4-1.6" />
      </g>
      {/* Air */}
      <g className="hub-anim-air">
        <path d="M18.6 9.6h2.6M19 11.6h2M18.6 13.6h1.6" />
      </g>
      {/* Leaves being blown */}
      <g className="hub-anim-blown-leaf hub-leaf-1">
        <path d="M16.4 16.4c-1.3.2-2.2-.3-2.5-1.5 1.3-.2 2.2.3 2.5 1.5z" />
      </g>
      <g className="hub-anim-blown-leaf hub-leaf-2">
        <path d="M20.4 18.2c-1.6.3-2.8-.4-3.2-1.8 1.6-.3 2.8.4 3.2 1.8z" />
      </g>
      <g className="hub-anim-blown-leaf hub-leaf-3">
        <path d="M17.2 21c-1.3-.3-2-1.1-1.9-2.3 1.3.3 2 1.1 1.9 2.3z" />
      </g>
    </HubIcon>
  );
}
