'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppIcon } from '@/components/icons/hub';
import Link from 'next/link';
import { Check, Move } from 'lucide-react';
import Modal from '@/components/ui/Modal';

export interface MobileGridActionItem {
  id: string;
  label: string;
  icon: AppIcon;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  external?: boolean;
  /** Icon color when not active (trade tools use their trade color). */
  iconClass?: string;
  /** Border color class instead of black (trade tools use their trade color). */
  borderClass?: string;
  /** Border colors to cycle through, one per second (ProTrades). */
  borderColors?: readonly string[];
}

interface MobileGridActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: MobileGridActionItem[];
  /** Drop a tile on another tile to move it. Same order the sidebar already saves. */
  onReorder?: (fromId: string, toId: string) => void;
  /**
   * Hint when reorder is on. Pass a translated string under [locale].
   * Admin has no NextIntlClientProvider, so the English default is used there.
   */
  dragHint?: string;
}

const DRAG_SLOP_PX = 8;
const BORDER_CYCLE_MS = 1000;
const DEFAULT_DRAG_HINT = 'Drag a tile to change the order';

export function MobileGridActionsModal({
  isOpen,
  onClose,
  title,
  items,
  onReorder,
  dragHint = DEFAULT_DRAG_HINT,
}: MobileGridActionsModalProps) {
  const cleanupRef = useRef<(() => void) | null>(null);
  const didDrag = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const canReorder = Boolean(onReorder) && items.length > 1;
  // Drag only after tapping the move button, so a swipe on the tiles scrolls the list on phones.
  const [arranging, setArranging] = useState(false);
  const reorderEnabled = canReorder && arranging;
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setArranging(false);
  }

  useEffect(() => () => cleanupRef.current?.(), []);
  useEffect(() => {
    if (!isOpen) cleanupRef.current?.();
  }, [isOpen]);

  // Tiles with borderColors change border color every second while the menu is open.
  const [borderTick, setBorderTick] = useState(0);
  const cycles = items.some((item) => item.borderColors && item.borderColors.length > 1);
  useEffect(() => {
    if (!isOpen || !cycles) return;
    const timer = setInterval(() => setBorderTick((tick) => tick + 1), BORDER_CYCLE_MS);
    return () => clearInterval(timer);
  }, [isOpen, cycles]);

  const beginDrag = (event: React.PointerEvent, id: string) => {
    if (!onReorder || event.button !== 0) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    cleanupRef.current?.();

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (cleanupRef.current === cleanup) cleanupRef.current = null;
    };

    function tileAt(x: number, y: number): string | null {
      return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-menu-id]')?.dataset.menuId ?? null;
    }

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_SLOP_PX) return;
        active = true;
        didDrag.current = true;
        setDraggingId(id);
      }
      ev.preventDefault();
      const overId = tileAt(ev.clientX, ev.clientY);
      const nextOver = overId && overId !== id ? overId : null;
      setDragOverId((current) => (current === nextOver ? current : nextOver));
    }

    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      const toId = active ? tileAt(ev.clientX, ev.clientY) : null;
      setDraggingId(null);
      setDragOverId(null);
      if (active && toId && toId !== id) onReorder?.(id, toId);
      if (active) window.setTimeout(() => { didDrag.current = false; }, 0);
    }

    cleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const stopIfDragged = (event: React.MouseEvent) => {
    if (!didDrag.current) return false;
    event.preventDefault();
    event.stopPropagation();
    didDrag.current = false;
    return true;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      showHeader
      headerAction={
        canReorder ? (
          <button
            type="button"
            onClick={() => setArranging((on) => !on)}
            aria-pressed={arranging}
            aria-label={arranging ? 'Done arranging' : 'Arrange tiles'}
            title={arranging ? 'Done' : 'Arrange tiles'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black transition-colors ${arranging ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'}`}
          >
            {arranging ? <Check className="h-5 w-5" /> : <Move className="h-5 w-5" />}
          </button>
        ) : null
      }
      maxWidth="md"
      contentClassName="p-0 md:p-6"
    >
      {reorderEnabled ? (
        <p className="px-3 pt-3 text-center text-sm text-gray-600">{dragHint}</p>
      ) : null}
      <div className={`grid grid-cols-3 gap-3 p-2 md:p-4 ${draggingId ? 'touch-none' : ''}`}>
        {items.map((item) => {
          const Icon = item.icon;
          const cycle = item.borderColors && item.borderColors.length > 0 ? item.borderColors : null;
          const style = cycle ? { borderColor: cycle[borderTick % cycle.length], transition: 'border-color 300ms' } : undefined;
          const className = `
            flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 ${cycle ? '' : item.borderClass ?? 'border-black'} font-medium hover:scale-[1.02]
            ${reorderEnabled ? 'cursor-grab touch-none select-none active:cursor-grabbing' : 'cursor-pointer transition-all'}
            ${draggingId === item.id ? 'opacity-40' : ''}
            ${dragOverId === item.id ? 'outline outline-2 outline-offset-2 outline-black' : ''}
            ${item.isActive ? 'bg-black text-white' : 'bg-white text-black'}
          `;
          const dragProps = reorderEnabled
            ? {
                'data-menu-id': item.id,
                draggable: false as const,
                title: dragHint,
                onPointerDown: (event: React.PointerEvent) => beginDrag(event, item.id),
              }
            : {};

          if (item.href) {
            if (item.external) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    if (stopIfDragged(event)) return;
                    onClose();
                  }}
                  className={className}
                  style={style}
                  {...dragProps}
                >
                  <Icon className={`w-6 h-6 ${item.borderClass || cycle ? 'hub-live-mobile' : ''} ${item.isActive ? 'text-white' : item.iconClass ?? 'text-red-600'}`} />
                  <span className="text-sm text-center">{item.label}</span>
                </a>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={(event) => {
                  if (stopIfDragged(event)) return;
                  onClose();
                }}
                className={className}
                style={style}
                {...dragProps}
              >
                <Icon className={`w-6 h-6 ${item.borderClass || cycle ? 'hub-live-mobile' : ''} ${item.isActive ? 'text-white' : item.iconClass ?? 'text-red-600'}`} />
                <span className="text-sm text-center">{item.label}</span>
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={(event) => {
                if (stopIfDragged(event)) return;
                onClose();
                item.onClick?.();
              }}
              className={className}
              style={style}
              {...dragProps}
            >
              <Icon className={`w-6 h-6 ${item.borderClass || cycle ? 'hub-live-mobile' : ''} ${item.isActive ? 'text-white' : item.iconClass ?? 'text-red-600'}`} />
              <span className="text-sm text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
