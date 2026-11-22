import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Landscape: a yard with a tree, a shrub and the sun over the ground line.
 * The tree has a clear trunk and a lobed crown so it never reads as a person.
 * Hover: the tree sways and the sun's rays turn.
 */
export function LandscapeIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      {/* Sun */}
      <circle cx="18.5" cy="5.5" r="1.9" />
      <g className="hub-anim-rays">
        <path d="M18.5 1.8v.6M18.5 8.6v.6M14.8 5.5h.6M21.6 5.5h.6" />
      </g>
      {/* Ground */}
      <path d="M2 21h20" />
      {/* Shrub */}
      <path d="M13.5 21c0-2.2 1.5-3.6 3.3-3.6.6-1.2 1.6-1.8 2.7-1.8 1.6 0 2.5 1.3 2.5 2.9V21" />
      {/* Tree: trunk with a branch and a three-lobed crown */}
      <g className="hub-anim-sway">
        <path d="M7.5 21v-7.5M7.5 16.2l2-1.6" />
        <path d="M4.6 13.6a2.6 2.6 0 0 1-.4-5 3.3 3.3 0 0 1 6.6 0 2.6 2.6 0 0 1-.4 5z" />
      </g>
    </HubIcon>
  );
}
