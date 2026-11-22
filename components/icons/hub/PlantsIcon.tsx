import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Plants: a pineapple (date) palm. Solid trunk that flares at the base, full arching crown.
 * Hover: the crown sways in the wind.
 */
export function PlantsIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      {/* Ground */}
      <path d="M5.5 21.5h13" />
      {/* Solid trunk, wider at the bottom */}
      <path d="M11.4 10.4c-.1 3.6-.5 7-1.6 10.4-.1.4.2.7.6.7h3.2c.4 0 .7-.3.6-.7-1.1-3.4-1.5-6.8-1.6-10.4z" fill="currentColor" strokeWidth={1.2} />
      {/* Crown */}
      <g className="hub-anim-fronds">
        <path d="M12.3 9.8C10.6 6.9 7.1 5.6 3 6.9c1.8.1 3.4.8 4.6 2" />
        <path d="M12.3 9.8c-2.9-.9-6.1.3-8 3.6 1-.8 2.2-1.2 3.4-1.3" />
        <path d="M12.3 9.8c1.7-2.9 5.2-4.2 9.3-2.9-1.8.1-3.4.8-4.6 2" />
        <path d="M12.3 9.8c2.9-.9 6.1.3 8 3.6-1-.8-2.2-1.2-3.4-1.3" />
        <path d="M12.3 9.8c-.4-2.9-2.1-5.1-4.9-6.3" />
        <path d="M12.3 9.8c.4-2.9 2.1-5.1 4.9-6.3" />
        <path d="M12.3 9.8V3.6" />
      </g>
    </HubIcon>
  );
}
