'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CHAT_REACTIONS } from '@/lib/chat/reactions';

export interface MessageAction {
  key: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface MessageActionsMenuProps {
  /** Which side of the bubble the menu lines up with. */
  align: 'left' | 'right';
  /** Open below the arrow, or above it when the message is near the bottom of the chat. */
  placement: 'below' | 'above';
  myReaction?: string;
  onReact?: (emoji: string | null) => void;
  actions: MessageAction[];
  onClose: () => void;
}

/** WhatsApp-style message menu: a row of reactions, then the actions (Reply, Copy, Delete…). */
export function MessageActionsMenu({ align, placement, myReaction, onReact, actions, onClose }: MessageActionsMenuProps) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={root}
      role="menu"
      className={`absolute z-40 flex w-56 flex-col gap-1.5 ${align === 'right' ? 'right-0' : 'left-0'} ${
        placement === 'below' ? 'top-7' : 'bottom-7 flex-col-reverse'
      }`}
    >
      {onReact ? (
        <div className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-1.5 py-1 shadow-lg">
          {CHAT_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(myReaction === emoji ? null : emoji);
                onClose();
              }}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-xl transition-transform hover:scale-125 ${
                myReaction === emoji ? 'bg-gray-200' : ''
              }`}
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              action.onClick();
            }}
            className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-100 ${
              action.danger ? 'border-t border-gray-100 text-red-600' : 'text-gray-900'
            }`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
