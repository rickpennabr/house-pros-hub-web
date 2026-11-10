'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

interface MenuPosition {
  top: number;
  left: number;
}

interface CrmRowActions {
  openId: string | null;
  position: MenuPosition | null;
  menuRef: RefObject<HTMLDivElement | null>;
  toggle: (rowId: string, button: HTMLButtonElement) => void;
  close: () => void;
}

/** Opens one row ⋯ menu at a time and closes it on an outside click. */
export function useCrmRowActions(): CrmRowActions {
  const [openId, setOpenId] = useState<string | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!openId) return;
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpenId(null);
        setPosition(null);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [openId]);

  const toggle = (rowId: string, button: HTMLButtonElement) => {
    if (openId === rowId) {
      setOpenId(null);
      setPosition(null);
      return;
    }
    buttonRef.current = button;
    const rect = button.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.right - 120, window.innerWidth - 130),
    });
    setOpenId(rowId);
  };

  const close = () => {
    setOpenId(null);
    setPosition(null);
  };

  return { openId, position, menuRef, toggle, close };
}

interface CrmRowActionsButtonProps {
  rowId: string;
  openId: string | null;
  onToggle: (rowId: string, button: HTMLButtonElement) => void;
}

export function CrmRowActionsButton({ rowId, openId, onToggle }: CrmRowActionsButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle(rowId, event.currentTarget);
      }}
      className="p-1 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
      aria-label="Actions"
      aria-expanded={openId === rowId}
    >
      <MoreVertical className="w-5 h-5" />
    </button>
  );
}

interface CrmRowActionsPortalProps {
  openId: string | null;
  position: MenuPosition | null;
  menuRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

export function CrmRowActionsPortal({ openId, position, menuRef, children }: CrmRowActionsPortalProps) {
  if (!openId || !position || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[120px] py-1 bg-white border border-gray-200 rounded-md shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {children}
    </div>,
    document.body
  );
}
