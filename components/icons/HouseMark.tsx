/**
 * The House Pros Hub house, drawn like the logo (hph-logo-simble-2.2.png): a thin red roof band
 * resting on two thick dark walls, open at the bottom.
 * plain: a person inside (center button, client portal). plus: Add. business: a briefcase (CRM). crm: "CRM" text.
 */
const RED = '#ED3237';
const DARK = '#363435';

export function HouseMark({
  variant = 'plain',
  className = 'h-8 w-8',
  tone = 'dark',
}: {
  variant?: 'plain' | 'plus' | 'crm' | 'business' | 'gear';
  className?: string;
  /** dark: charcoal walls and letters (on white). light: white walls and letters (on black). */
  tone?: 'dark' | 'light';
}) {
  const INK = tone === 'light' ? '#FFFFFF' : DARK;
  // viewBox starts at y=3 so the house (roof top ~9, wall bottom 43.5) sits in the middle of the box.
  return (
    <svg viewBox="0 3 48 46" className={className} aria-hidden>
      {/* Roof: a flat band, mitered at the peak, ending on the wall tops */}
      <path d="M3.5 24L24 11L44.5 24" fill="none" stroke={RED} strokeWidth="4.2" strokeLinejoin="miter" strokeMiterlimit="10" />
      {/* Walls: two thick posts, like the outer strokes of the H's */}
      <rect x="4" y="22" width="6" height="21.5" fill={INK} />
      <rect x="38" y="22" width="6" height="21.5" fill={INK} />

      {variant === 'plain' ? (
        <g fill={INK}>
          {/* A person: the client */}
          <circle cx="24" cy="29.6" r="3.9" />
          <path d="M15.8 43.5C15.8 38 19.2 35.2 24 35.2C28.8 35.2 32.2 38 32.2 43.5Z" />
        </g>
      ) : null}
      {variant === 'plus' ? <path d="M24 26.5V40.5M17 33.5H31" stroke={INK} strokeWidth="3.8" /> : null}
      {variant === 'gear' ? (
        <g fill="none" stroke={INK} strokeLinecap="round">
          {/* Settings gear (Manage accounts) */}
          <path d="M29.60 33.50L32.20 33.50M27.96 37.46L29.80 39.30M24.00 39.10L24.00 41.70M20.04 37.46L18.20 39.30M18.40 33.50L15.80 33.50M20.04 29.54L18.20 27.70M24.00 27.90L24.00 25.30M27.96 29.54L29.80 27.70" strokeWidth="3" />
          <circle cx="24" cy="33.5" r="5.4" strokeWidth="2.6" />
          <circle cx="24" cy="33.5" r="1.6" fill={INK} stroke="none" />
        </g>
      ) : null}
      {variant === 'business' ? (
        <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinejoin="round">
          <path d="M20.5 29.5V26.8H27.5V29.5" />
          <rect x="15.5" y="29.5" width="17" height="11.5" rx="1.6" />
          <path d="M15.5 34.5H32.5" />
          <path d="M24 33V36" strokeLinecap="round" />
        </g>
      ) : null}
      {variant === 'crm' ? (
        <text
          x="24"
          y="38"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="10.5"
          fontWeight="900"
          letterSpacing="-0.4"
          fill={INK}
        >
          CRM
        </text>
      ) : null}
    </svg>
  );
}
