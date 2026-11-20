'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';

export interface DocumentBrandBusiness {
  business_name: string;
  business_logo?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  company_tagline?: string | null;
}

interface DocumentBrandHeaderProps {
  /** Document title shown top-left (ESTIMATE, INVOICE, MAINTENANCE AGREEMENT, …). */
  title: string;
  business: DocumentBrandBusiness | null | undefined;
  /** Accent color for title + bottom border. Defaults to black. */
  themeColor?: string;
  /** Optional line under the title (agreement kind, helper text). */
  subtitle?: ReactNode;
  /** Optional control next to the business name (e.g. invoice company edit). */
  nameAccessory?: ReactNode;
  /** Right column content under/beside the logo (totals, tagline, doc #). */
  rightMeta?: ReactNode;
  className?: string;
}

function websiteHref(website: string) {
  return website.startsWith('http') ? website : `https://${website}`;
}

function LogoMark({ name, logo }: { name: string; logo?: string | null }) {
  const initial = (name.trim().charAt(0) || 'P').toUpperCase();
  if (logo) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-gray-200 md:h-16 md:w-16">
        <Image src={logo} alt="" fill className="object-cover" sizes="64px" />
      </div>
    );
  }
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-100 text-lg font-bold text-gray-700 md:h-16 md:w-16"
      aria-hidden
    >
      {initial}
    </div>
  );
}

/**
 * Standard letterhead for CRM documents (estimates + invoices):
 * title + business | contact | logo + meta.
 */
export function DocumentBrandHeader({
  title,
  business,
  themeColor = '#000000',
  subtitle,
  nameAccessory,
  rightMeta,
  className = '',
}: DocumentBrandHeaderProps) {
  const name = business?.business_name?.trim() || 'Business';
  const website = business?.website?.trim() || '';

  return (
    <header
      className={`grid grid-cols-1 gap-4 border-b-2 md:grid-cols-3 md:gap-6 ${className}`}
      style={{ borderColor: themeColor }}
    >
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-tight" style={{ color: themeColor }}>
          {title}
        </h1>
        {subtitle ? <div className="mt-1 text-sm text-gray-600">{subtitle}</div> : null}
        <div className="mt-2 flex items-center gap-2">
          <p className="font-semibold text-black">{name}</p>
          {nameAccessory}
        </div>
        {business?.address ? (
          <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{business.address}</p>
        ) : null}
      </div>

      <div className="flex flex-col justify-center text-sm text-gray-700 md:items-center">
        <div className="text-left">
          {business?.email ? <span className="block">{business.email}</span> : null}
          {business?.phone ? <span className="block">{business.phone}</span> : null}
          {website ? (
            <a
              href={websiteHref(website)}
              className="block text-gray-700 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {website}
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex items-start justify-end gap-3">
        <LogoMark name={name} logo={business?.business_logo} />
        <div className="min-w-0 text-right">
          {rightMeta ?? (
            <>
              <p className="font-bold text-black">{name}</p>
              {business?.company_tagline ? (
                <p className="mt-0.5 text-sm italic" style={{ color: themeColor }}>
                  {business.company_tagline}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
