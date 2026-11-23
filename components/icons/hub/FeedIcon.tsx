import { HubIcon, type HubIconProps } from './HubIcon';

/**
 * Feed: a rolled newspaper. A tall page with three text lines, its left edge curling into a roll.
 * Hover: the text lines write themselves in, one after another.
 */
export function FeedIcon(props: HubIconProps) {
  return (
    <HubIcon {...props}>
      {/* Page with the roll on its left, one outline */}
      <path d="M8 8H5.75A2.25 2.25 0 0 0 3.5 10.25v8A2.25 2.25 0 0 0 5.75 20.5H18a2.5 2.5 0 0 0 2.5-2.5V5.5A2.5 2.5 0 0 0 18 3h-7.5A2.5 2.5 0 0 0 8 5.5v12.75a2.25 2.25 0 0 1-2.25 2.25" />
      {/* Inside of the roll */}
      <path d="M5.75 11v6.25" />
      {/* Text lines */}
      <path className="hub-anim-news hub-news-1" d="M12 8h4.5" />
      <path className="hub-anim-news hub-news-2" d="M12 11.75h4.5" />
      <path className="hub-anim-news hub-news-3" d="M12 15.5h4.5" />
    </HubIcon>
  );
}
