'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

const buttonClasses =
  'md:hidden fixed z-30 h-14 w-14 rounded-md bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg bottom-[85px] right-[65px]';

interface AdminFloatingAddButtonProps {
  /** When set, render as a link to this href (e.g. /admin/customers). */
  href?: string;
  /** When set, render as a button and call this on click (e.g. open add form). */
  onClick?: () => void;
  /** Accessible label for the button/link. */
  ariaLabel: string;
}

/**
 * Mobile-only floating Add button used across admin pages (dashboard, customers, businesses, suppliers, storage).
 * Same position and style everywhere; either links to a page (href) or runs an action (onClick).
 */
export function AdminFloatingAddButton({ href, onClick, ariaLabel }: AdminFloatingAddButtonProps) {
  if (href) {
    return (
      <Link
        href={href}
        className={buttonClasses}
        aria-label={ariaLabel}
      >
        <Plus className="w-7 h-7" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonClasses}
      aria-label={ariaLabel}
    >
      <Plus className="w-7 h-7" />
    </button>
  );
}
