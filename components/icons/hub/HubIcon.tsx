import type { ReactNode, SVGProps } from 'react';

/**
 * House Pros icon system.
 *
 * Our own icons, drawn to match the lucide line style (24×24 grid, 2px round strokes,
 * currentColor) so they sit next to lucide icons without looking different.
 *
 * Every icon moves a little on hover. The animation runs when the icon itself is hovered
 * or when any parent with the Tailwind `group` class is hovered or focused (menu rows,
 * cards, buttons). The keyframes live in app/globals.css under "House Pros icons", and
 * they are skipped for people who ask for reduced motion.
 *
 * Use them like lucide icons: <LandscapeIcon className="h-5 w-5 text-green-700" />
 */
export type HubIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { title?: string };

export function HubIcon({ title, className = '', strokeWidth = 2, children, ...props }: HubIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      className={`hub-icon ${className}`}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
