'use client';

import { useTranslations } from 'next-intl';
import { Scale, LayoutGrid } from 'lucide-react';
import type { ProAccountRole } from '@/lib/utils/proAccountRole';

interface ProRoleScopeNoticeProps {
  role: ProAccountRole;
  /** Compact bullets for role cards; full for invite / upgrade screens. */
  compact?: boolean;
  className?: string;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function ProRoleScopeNotice({ role, compact = false, className = '' }: ProRoleScopeNoticeProps) {
  const t = useTranslations('auth.signup.roleScope');
  const hubItems = asStringList(t.raw(`${role}.hub`));
  const lawItems = asStringList(t.raw(`${role}.law`));

  if (!hubItems.length && !lawItems.length) return null;

  return (
    <div
      className={`rounded-lg border border-gray-300 bg-gray-50 ${compact ? 'p-2.5' : 'p-3'} ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {hubItems.length > 0 ? (
          <section>
            <div className="mb-1 flex items-center gap-1.5">
              <LayoutGrid className={`shrink-0 text-red-500 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
              <h4 className={`font-semibold text-black ${compact ? 'text-xs' : 'text-sm'}`}>
                {t('hubTitle')}
              </h4>
            </div>
            <ul className={`list-disc space-y-0.5 pl-4 text-gray-700 ${compact ? 'text-[11px] leading-snug' : 'text-xs leading-relaxed'}`}>
              {hubItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {lawItems.length > 0 ? (
          <section>
            <div className="mb-1 flex items-center gap-1.5">
              <Scale className={`shrink-0 text-red-500 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
              <h4 className={`font-semibold text-black ${compact ? 'text-xs' : 'text-sm'}`}>
                {t('lawTitle')}
              </h4>
            </div>
            <ul className={`list-disc space-y-0.5 pl-4 text-gray-700 ${compact ? 'text-[11px] leading-snug' : 'text-xs leading-relaxed'}`}>
              {lawItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {!compact ? (
          <p className="text-[11px] leading-snug text-gray-500">{t('disclaimer')}</p>
        ) : null}
      </div>
    </div>
  );
}
