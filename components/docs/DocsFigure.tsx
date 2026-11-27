import Image from 'next/image';
import type { DocsFigureRole } from '@/lib/docs/types';
import { PROBOT_ASSETS } from '@/lib/constants/probot';

const ROLE_LABEL: Record<DocsFigureRole, string> = {
  guide: 'ProBot',
  business: 'ProBot the owner',
  customer: 'ProBot the customer',
  plumber: 'ProBot the plumber',
  landscaper: 'ProBot the landscaper',
  electrician: 'ProBot the electrician',
  painter: 'ProBot the painter',
  crew: 'ProBot on the crew',
};

const ROLE_TINT: Record<DocsFigureRole, string> = {
  guide: 'bg-sky-50',
  business: 'bg-amber-50',
  customer: 'bg-emerald-50',
  plumber: 'bg-blue-50',
  landscaper: 'bg-lime-50',
  electrician: 'bg-yellow-50',
  painter: 'bg-rose-50',
  crew: 'bg-orange-50',
};

interface DocsFigureProps {
  role: DocsFigureRole;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Flat ProBot figure — face stays clear; trade prop sits in the corner. */
export function DocsFigure({ role, label, size = 'md', className = '' }: DocsFigureProps) {
  const px = size === 'lg' ? 96 : size === 'sm' ? 56 : 72;
  const box = px + 16;
  const caption = label ?? ROLE_LABEL[role];

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-lg border-2 border-black ${ROLE_TINT[role]}`}
        style={{ width: box, height: box }}
      >
        <Image
          src={PROBOT_ASSETS.avatar}
          alt=""
          width={px}
          height={px}
          className="object-contain"
        />
        {role !== 'guide' ? <RoleBadge role={role} /> : null}
      </div>
      <p className="max-w-[7.5rem] text-center text-xs font-medium leading-tight text-gray-800">{caption}</p>
    </div>
  );
}

/** Small prop in the bottom-right — never draws over the face. */
function RoleBadge({ role }: { role: Exclude<DocsFigureRole, 'guide'> }) {
  return (
    <span
      className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-md border-2 border-black bg-white shadow-sm"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        {role === 'business' ? (
          <>
            <rect x="4" y="8" width="16" height="11" rx="1.5" fill="#78350f" stroke="#111" strokeWidth="1.4" />
            <path d="M9 8V7a3 3 0 0 1 6 0v1" stroke="#111" strokeWidth="1.4" />
          </>
        ) : null}
        {role === 'customer' ? (
          <path d="M4 11 L12 5 L20 11 V19 H4 Z" fill="#059669" stroke="#111" strokeWidth="1.4" />
        ) : null}
        {role === 'plumber' ? (
          <path d="M7 6h10v2H7zm3 2h4v3h3v2h-3v5h-2v-5H8v-2h3z" fill="#64748b" stroke="#111" strokeWidth="1" />
        ) : null}
        {role === 'landscaper' ? (
          <>
            <ellipse cx="12" cy="10" rx="7" ry="5" fill="#65a30d" stroke="#111" strokeWidth="1.3" />
            <path d="M12 14v5" stroke="#166534" strokeWidth="2" />
          </>
        ) : null}
        {role === 'electrician' ? (
          <path d="M11 3 L7 13 h4 l-1 8 7-12 h-4 l2-6 Z" fill="#eab308" stroke="#111" strokeWidth="1.2" />
        ) : null}
        {role === 'painter' ? (
          <>
            <rect x="5" y="5" width="10" height="8" rx="1" fill="#e11d48" stroke="#111" strokeWidth="1.2" />
            <path d="M10 13v7" stroke="#111" strokeWidth="2" />
          </>
        ) : null}
        {role === 'crew' ? (
          <path d="M4 9h16l-3 5H7Z" fill="#ea580c" stroke="#111" strokeWidth="1.3" />
        ) : null}
      </svg>
    </span>
  );
}
