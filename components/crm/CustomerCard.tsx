'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Building2, Mail, Phone, MapPin, Globe, MoreVertical, FileText, FileCheck, FolderOpen, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import type { Database } from '@/lib/types/supabase';
import type { CrmContactRole } from '@/lib/crm/contact-role';

type CRMCustomerRow = Database['public']['Tables']['pro_crm_customers']['Row'] & {
  roles?: CrmContactRole[];
};

export interface CustomerCardMenuActions {
  onCreateInvoice?: (customerId: string) => void;
  onCreateEstimate?: (customerId: string) => void;
  onCreateProject?: (customerId: string) => void;
  onScheduleTask?: (customerId: string) => void;
  onEdit: (customerId: string) => void;
  onDelete?: (customerId: string) => void;
}

interface CustomerCardProps {
  customer: CRMCustomerRow;
  onEdit: (id: string) => void;
  onCreateInvoice?: (customerId: string) => void;
  onCreateEstimate?: (customerId: string) => void;
  onCreateProject?: (customerId: string) => void;
  onScheduleTask?: (customerId: string) => void;
  onDelete?: (customerId: string) => void;
}

function displayName(c: CRMCustomerRow): string {
  if (c.display_name?.trim()) return c.display_name.trim();
  const parts = [c.first_name?.trim(), c.last_name?.trim()].filter(Boolean);
  return parts.length ? parts.join(' ') : 'No name';
}

function buildMapsUrl(c: CRMCustomerRow): string | null {
  const parts = [
    c.street_address,
    c.apartment,
    [c.city, c.state, c.zip_code].filter(Boolean).join(', '),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const q = encodeURIComponent(parts.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const iconButtonClass =
  'w-9 h-9 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0 cursor-pointer hover:bg-gray-50 transition-colors';

export default function CustomerCard({
  customer,
  onEdit,
  onCreateInvoice,
  onCreateEstimate,
  onCreateProject,
  onScheduleTask,
  onDelete,
}: CustomerCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const name = displayName(customer);
  const primaryPhone = customer.phone?.trim() || customer.mobile_number?.trim();
  const hasEmail = !!customer.email?.trim();
  const hasPhone = !!primaryPhone;
  const hasWebsite = !!customer.website?.trim();
  const mapsUrl = buildMapsUrl(customer);
  const hasLocation = !!mapsUrl;
  const hasAnyContact = hasEmail || hasPhone || hasWebsite || hasLocation;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setMenuOpen(false);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuPosition(null);
  };

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
      setMenuPosition(null);
      return;
    }
    const button = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 180;
    const left = Math.min(button.right - menuWidth, window.innerWidth - menuWidth - 8);
    const spaceBelow = window.innerHeight - button.bottom - 8;
    const above = spaceBelow < 200;
    const top = above ? button.top - 4 : button.bottom + 4;
    setMenuPosition({ top, left, above });
    setMenuOpen(true);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(customer.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(customer.id);
        }
      }}
      className="border-2 border-black rounded-lg bg-white overflow-visible hover:shadow-lg transition-shadow cursor-pointer text-left w-full relative"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">{name}</h3>
            <p className="mt-0.5 text-xs text-gray-500 truncate">{customer.display_id ?? 'Pending ID'}</p>
            {(customer.roles ?? []).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {customer.roles!.filter((role) => role.slug !== 'installer').map((role) => (
                  <span key={role.id} className="rounded-full border border-black px-2 py-0.5 text-[11px] font-medium text-black">
                    {role.name}
                  </span>
                ))}
              </div>
            )}
            {customer.company_name?.trim() && (
              <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-600 truncate">
                <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                <span className="truncate">{customer.company_name}</span>
              </div>
            )}
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={openMenu}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
              aria-label="Customer actions"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && menuPosition && typeof document !== 'undefined' &&
              createPortal(
                <div
                  ref={dropdownRef}
                  className="fixed z-[100] min-w-[180px] py-1 bg-white border border-gray-200 rounded-lg shadow-lg text-left"
                  style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                    transform: menuPosition.above ? 'translateY(-100%)' : undefined,
                  }}
                >
                  {onCreateInvoice && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateInvoice(customer.id);
                      closeMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    Create invoice
                  </button>
                )}
                {onCreateEstimate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateEstimate(customer.id);
                      closeMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                  >
                    <FileCheck className="w-3.5 h-3.5 shrink-0" />
                    Create estimate
                  </button>
                )}
                {onCreateProject && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateProject(customer.id);
                      closeMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    Create project
                  </button>
                )}
                {onScheduleTask && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onScheduleTask(customer.id);
                      closeMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                    Schedule task
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(customer.id);
                    closeMenu();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 shrink-0" />
                  Edit
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(customer.id);
                      closeMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    Delete
                  </button>
                )}
                </div>,
                document.body
              )}
          </div>
        </div>
      </div>
      {hasAnyContact && (
        <div className="h-[50px] flex items-center px-2 border-t border-black">
          <div className="flex items-center gap-2 w-full">
            {hasEmail && (
              <a
                href={`mailto:${customer.email}`}
                onClick={(e) => e.stopPropagation()}
                className={iconButtonClass}
                aria-label="Email"
              >
                <Mail className="w-5 h-5 text-black" />
              </a>
            )}
            {hasPhone && (
              <a
                href={`tel:${primaryPhone}`}
                onClick={(e) => e.stopPropagation()}
                className={iconButtonClass}
                aria-label="Phone"
              >
                <Phone className="w-5 h-5 text-black" />
              </a>
            )}
            {hasWebsite && (
              <a
                href={customer.website!.startsWith('http') ? customer.website! : `https://${customer.website}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={iconButtonClass}
                aria-label="Website"
              >
                <Globe className="w-5 h-5 text-black" />
              </a>
            )}
            {hasLocation && (
              <a
                href={mapsUrl!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={iconButtonClass}
                aria-label="Location"
              >
                <MapPin className="w-5 h-5 text-black" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
