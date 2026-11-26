import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * ProQuote: an estimate sheet whose lines get filled in, one tap at a time.
 * Hover (or always, on phones with hub-live-mobile): the lines pop in one after another.
 */
export function ProQuoteIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" />
      <path d="M14 2.5V8h5.5" />
      <g className="hub-anim-tile hub-tile-1">
        <path d="M8 11h8" />
      </g>
      <g className="hub-anim-tile hub-tile-2">
        <path d="M8 14.5h8" />
      </g>
      <g className="hub-anim-tile hub-tile-3">
        <path d="M8 18h5" />
      </g>
    </HubIcon>
  );
}
