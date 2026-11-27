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

/** Flat ProBot figure with a simple trade costume — no 3D, just the Hub bot + props. */
export function DocsFigure({ role, label, size = 'md', className = '' }: DocsFigureProps) {
  const px = size === 'lg' ? 96 : size === 'sm' ? 56 : 72;
  const caption = label ?? ROLE_LABEL[role];

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-lg border-2 border-black ${ROLE_TINT[role]}`}
        style={{ width: px + 16, height: px + 16 }}
      >
        <Image
          src={PROBOT_ASSETS.avatar}
          alt=""
          width={px}
          height={px}
          className="object-contain"
        />
        <Costume role={role} />
      </div>
      <p className="max-w-[7.5rem] text-center text-xs font-medium leading-tight text-gray-800">{caption}</p>
    </div>
  );
}

function Costume({ role }: { role: DocsFigureRole }) {
  if (role === 'guide') return null;

  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {role === 'business' ? (
        <>
          <rect x="22" y="8" width="20" height="6" rx="1" fill="#111" />
          <path d="M28 14h8l2 10H26l2-10Z" fill="#1f2937" />
          <rect x="38" y="36" width="14" height="10" rx="1" fill="#78350f" stroke="#111" strokeWidth="1.5" />
        </>
      ) : null}
      {role === 'customer' ? (
        <>
          <path d="M12 28 L22 20 L32 28 V38 H12 Z" fill="#059669" stroke="#111" strokeWidth="1.5" />
          <rect x="18" y="30" width="5" height="8" fill="#fff" stroke="#111" strokeWidth="1" />
        </>
      ) : null}
      {role === 'plumber' ? (
        <>
          <path d="M18 10 h28 l-4 8 H22 Z" fill="#f59e0b" stroke="#111" strokeWidth="1.5" />
          <rect x="26" y="6" width="12" height="5" rx="1" fill="#b45309" />
          <path d="M40 34 h14 v3 h-6 v10 h-3 v-10 h-5 Z" fill="#64748b" stroke="#111" strokeWidth="1.2" />
        </>
      ) : null}
      {role === 'landscaper' ? (
        <>
          <ellipse cx="48" cy="22" rx="10" ry="7" fill="#65a30d" stroke="#111" strokeWidth="1.2" />
          <path d="M48 28 v12" stroke="#166534" strokeWidth="2" />
          <path d="M14 40 h16 l-2 8 H16 Z" fill="#854d0e" stroke="#111" strokeWidth="1.2" />
        </>
      ) : null}
      {role === 'electrician' ? (
        <>
          <path d="M18 10 h28 l-4 8 H22 Z" fill="#eab308" stroke="#111" strokeWidth="1.5" />
          <path d="M44 30 l8 10 h-6 l4 12 -10-14 h6 Z" fill="#facc15" stroke="#111" strokeWidth="1.2" />
        </>
      ) : null}
      {role === 'painter' ? (
        <>
          <rect x="40" y="28" width="14" height="10" rx="1" fill="#e11d48" stroke="#111" strokeWidth="1.2" />
          <path d="M44 38 v12" stroke="#111" strokeWidth="2" />
          <circle cx="20" cy="18" r="6" fill="#fb7185" stroke="#111" strokeWidth="1.2" />
        </>
      ) : null}
      {role === 'crew' ? (
        <>
          <path d="M18 10 h28 l-4 8 H22 Z" fill="#ea580c" stroke="#111" strokeWidth="1.5" />
          <rect x="40" y="34" width="12" height="8" rx="1" fill="#9a3412" stroke="#111" strokeWidth="1.2" />
        </>
      ) : null}
    </svg>
  );
}
