import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Sand, soil & gravel: a mound of loose material with grains pouring onto it.
 * Hover: the grains keep falling onto the pile.
 */
export function SoilIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      <path d="M2.5 20.5c2.6-5.8 5.8-8.6 9.5-8.6s6.9 2.8 9.5 8.6z" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.6" cy="17.6" r="0.8" />
        <circle cx="12" cy="15.3" r="0.8" />
        <circle cx="15.3" cy="17.8" r="0.8" />
        <circle cx="11.6" cy="18.9" r="0.6" />
      </g>
      <g className="hub-anim-grains" fill="currentColor" stroke="none">
        <circle cx="12" cy="3.5" r="0.9" />
        <circle cx="10.4" cy="6.4" r="0.8" />
        <circle cx="13.5" cy="7.2" r="0.8" />
      </g>
    </HubIcon>
  );
}
