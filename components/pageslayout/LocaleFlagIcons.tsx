'use client';

interface FlagIconProps {
  className?: string;
}

/** US flag icon (English). */
export function UsFlagIcon({ className = 'w-full h-full' }: FlagIconProps) {
  return (
    <svg viewBox="0 0 27 18" className={className} aria-hidden>
      <rect y="0" width="27" height="18" fill="#FFFFFF" />
      <rect x="0" y="0" width="11" height="8" fill="#002868" />
      <rect y="0" width="27" height="1.4" fill="#BF0A30" />
      <rect y="2.8" width="27" height="1.4" fill="#BF0A30" />
      <rect y="5.6" width="27" height="1.4" fill="#BF0A30" />
      <rect y="8.4" width="27" height="1.4" fill="#BF0A30" />
      <rect y="11.2" width="27" height="1.4" fill="#BF0A30" />
      <rect y="14" width="27" height="1.4" fill="#BF0A30" />
      <rect y="16.8" width="27" height="1.2" fill="#BF0A30" />
      <circle cx="1.5" cy="1.2" r="0.3" fill="#FFFFFF" />
      <circle cx="3.5" cy="1.2" r="0.3" fill="#FFFFFF" />
      <circle cx="5.5" cy="1.2" r="0.3" fill="#FFFFFF" />
      <circle cx="7.5" cy="1.2" r="0.3" fill="#FFFFFF" />
      <circle cx="9.5" cy="1.2" r="0.3" fill="#FFFFFF" />
      <circle cx="1.5" cy="3.2" r="0.3" fill="#FFFFFF" />
      <circle cx="3.5" cy="3.2" r="0.3" fill="#FFFFFF" />
      <circle cx="5.5" cy="3.2" r="0.3" fill="#FFFFFF" />
      <circle cx="7.5" cy="3.2" r="0.3" fill="#FFFFFF" />
      <circle cx="9.5" cy="3.2" r="0.3" fill="#FFFFFF" />
      <circle cx="2.5" cy="2.2" r="0.3" fill="#FFFFFF" />
      <circle cx="4.5" cy="2.2" r="0.3" fill="#FFFFFF" />
      <circle cx="6.5" cy="2.2" r="0.3" fill="#FFFFFF" />
      <circle cx="8.5" cy="2.2" r="0.3" fill="#FFFFFF" />
    </svg>
  );
}

/** Spain flag icon (Spanish). */
export function SpainFlagIcon({ className = 'w-full h-full' }: FlagIconProps) {
  return (
    <svg viewBox="0 0 27 18" className={className} aria-hidden>
      <rect y="0" width="27" height="6" fill="#AA151B" />
      <rect y="6" width="27" height="6" fill="#F1BF00" />
      <rect y="12" width="27" height="6" fill="#AA151B" />
    </svg>
  );
}

/** Brazil flag icon (Portuguese). */
export function BrazilFlagIcon({ className = 'w-full h-full' }: FlagIconProps) {
  return (
    <svg viewBox="0 0 27 18" className={className} aria-hidden>
      <rect y="0" width="27" height="18" fill="#009B3A" />
      <path fill="#FEDF00" d="M13.5 0L27 9 13.5 18 0 9z" />
      <circle cx="13.5" cy="9" r="4.5" fill="#002776" />
    </svg>
  );
}
