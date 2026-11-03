'use client';

import { ReactNode, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Building2, HardDrive, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';
import { ProDriveMeter } from '@/components/drive/ProDriveMeter';
import type { DriveOwnerType, DriveUsage } from '@/lib/drive/types';

interface BusinessOption {
  id: string;
  name: string;
}

interface ProDriveWorkspaceProps {
  locale: string;
  businesses: BusinessOption[];
  ownerType: DriveOwnerType;
  ownerId: string;
  onOwnerChange: (ownerType: DriveOwnerType, ownerId: string) => void;
  usage: DriveUsage | null;
  query: string;
  onQueryChange: (query: string) => void;
  showNavigation?: boolean;
  children: ReactNode;
}

export function ProDriveWorkspace({
  locale,
  businesses,
  ownerType,
  ownerId,
  onOwnerChange,
  usage,
  query,
  onQueryChange,
  showNavigation = true,
  children,
}: ProDriveWorkspaceProps) {
  const t = useTranslations('prodrive');
  const searchRef = useRef<HTMLInputElement>(null);
  const myDriveActive = ownerType === 'user';

  return (
    <div className="flex min-h-screen w-full flex-col overflow-y-auto bg-white md:h-screen md:overflow-hidden">
      <header className="sticky top-0 z-50 h-[60px] shrink-0 border-b-2 border-black bg-white px-2 py-2">
        <div className="flex h-full w-full items-center gap-2 md:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/${locale}`}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-white transition-colors hover:bg-gray-50"
              aria-label="Go to home"
            >
              <Image
                src="/house-pros-hub-logo-simble-bot.png"
                alt="House Pros Hub"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </Link>
            <h1 className="hidden whitespace-nowrap text-xl font-bold text-black md:block md:text-2xl">
              {t('title')}
            </h1>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center px-1">
            <div className="relative w-full max-w-xl">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={t('search')}
                className="h-10 w-full rounded-lg border-2 border-black bg-white pl-9 pr-9 text-sm text-black placeholder-gray-500 focus:outline-none"
              />
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    onQueryChange('');
                    searchRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-0.5 text-gray-500 hover:text-black"
                  aria-label={t('cancel')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <ProfileIcon />
          </div>
        </div>
      </header>

      <div className="flex flex-col md:min-h-0 md:flex-1 md:flex-row md:overflow-hidden">
        {showNavigation && (
          <>
            <div className="shrink-0 border-b-2 border-black bg-white md:hidden">
              <nav className="flex h-[60px] items-center gap-2 overflow-x-auto px-2">
                <DriveNavButton
                  active={myDriveActive}
                  label={t('myDrive')}
                  icon={HardDrive}
                  onClick={() => onOwnerChange('user', '')}
                />
                {businesses.map((business) => (
                  <DriveNavButton
                    key={business.id}
                    active={ownerType === 'business' && ownerId === business.id}
                    label={business.name}
                    icon={Building2}
                    onClick={() => onOwnerChange('business', business.id)}
                  />
                ))}
              </nav>
            </div>

            <aside className="hidden h-full w-64 shrink-0 flex-col border-r-2 border-black bg-white md:flex">
              <nav className="flex-1 space-y-2 overflow-y-auto p-4">
                <DriveNavButton
                  active={myDriveActive}
                  label={t('myDrive')}
                  icon={HardDrive}
                  onClick={() => onOwnerChange('user', '')}
                />
                {businesses.map((business) => (
                  <DriveNavButton
                    key={business.id}
                    active={ownerType === 'business' && ownerId === business.id}
                    label={business.name}
                    icon={Building2}
                    onClick={() => onOwnerChange('business', business.id)}
                  />
                ))}
              </nav>
              <div className="shrink-0 border-t-2 border-black p-4">
                <ProDriveMeter usage={usage} layout="sidebar" />
              </div>
            </aside>
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col bg-white md:overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          {showNavigation && (
            <div className="shrink-0 border-t-2 border-black p-3 md:hidden">
              <ProDriveMeter usage={usage} layout="sidebar" />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function DriveNavButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof HardDrive;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border-2 px-3 text-left font-medium text-black transition-all duration-300 hover:scale-[1.02] md:h-auto md:w-full md:gap-3 md:px-4 md:py-3 ${
        active ? 'border-black bg-white' : 'border-transparent hover:border-gray-400'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 text-red-600 transition-transform duration-300 group-hover:scale-110 md:h-5 md:w-5" />
      <span className="truncate">{label}</span>
    </button>
  );
}
