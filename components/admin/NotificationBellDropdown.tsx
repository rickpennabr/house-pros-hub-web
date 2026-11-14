'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Bell, User, Briefcase, MessageCircle, ClipboardList, Calendar, Mail } from 'lucide-react';
import type { AdminNotificationEntityType, AdminNotificationEventType } from '@/lib/types/adminNotification';
import { useOptionalChat } from '@/contexts/ChatContext';
import { useOptionalAuth } from '@/contexts/AuthContext';

export type NewSignupItem = {
  id: string;
  type: AdminNotificationEntityType | 'customer' | 'contractor';
  name: string;
  createdAt: string;
  href: string;
  eventType?: AdminNotificationEventType;
  detail?: string | null;
};

function entityLabel(type: NewSignupItem['type']): string {
  switch (type) {
    case 'customer':
      return 'Customer';
    case 'contractor':
      return 'Contractor';
    case 'realtor':
      return 'Realtor';
    case 'installer':
      return 'Installer';
    case 'business':
      return 'Business';
    default:
      return '';
  }
}

function eventSummary(item: NewSignupItem): string {
  const who = entityLabel(item.type);
  switch (item.eventType) {
    case 'deletion':
      return `${who || 'Account'} was deleted`;
    case 'estimate':
      return 'requested an estimate';
    case 'estimate_accepted':
      return 'accepted an estimate';
    case 'booking':
      return 'booked an appointment';
    case 'incoming_email':
      return 'emailed the platform';
    case 'maintenance':
      return 'stopped a maintenance service';
    default:
      return who === 'Business' ? 'was added' : `${who || 'Account'} signed up`;
  }
}

function EventIcon({ item }: { item: NewSignupItem }) {
  if (item.eventType === 'estimate' || item.eventType === 'estimate_accepted') {
    return <ClipboardList className="w-4 h-4 text-black" />;
  }
  if (item.eventType === 'booking') return <Calendar className="w-4 h-4 text-black" />;
  if (item.eventType === 'incoming_email') return <Mail className="w-4 h-4 text-black" />;
  if (item.type === 'customer') return <User className="w-4 h-4 text-black" />;
  return <Briefcase className="w-4 h-4 text-black" />;
}

type ChatUnreadBellItem = {
  id: string;
  conversationId: string;
  sender: 'visitor' | 'admin';
  title: string;
  preview: string;
  createdAt: string;
  probotHrefQuery: string;
};

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface NotificationBellDropdownProps {
  notificationCount?: number;
  /** Called after marking all read so parent can refresh the count */
  onMarkAllRead?: () => void;
  /** 'signups' = admin new signups (default); 'chat' = customer ProBot unread messages */
  variant?: 'signups' | 'chat';
  /** For chat variant: locale for ProBot link */
  locale?: string;
}

export function NotificationBellDropdown({ notificationCount = 0, onMarkAllRead, variant = 'signups', locale = 'en' }: NotificationBellDropdownProps) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NewSignupItem[]>([]);
  const [chatUnreadItems, setChatUnreadItems] = useState<ChatUnreadBellItem[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(null);
  const isChat = variant === 'chat';
  const visitorId = useOptionalChat()?.visitorId ?? '';
  const user = useOptionalAuth()?.user;
  const isContractor = Boolean(user?.businessId);

  const handleMarkAllRead = async () => {
    if (isChat) return;
    setMarkingRead(true);
    try {
      const res = await fetch('/api/admin/notifications/mark-read', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setNotificationItems([]);
        onMarkAllRead?.();
      }
    } finally {
      setMarkingRead(false);
    }
  };

  useLayoutEffect(() => {
    if (!notificationOpen) return;

    const update = () => {
      const button = bellButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuBox({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [notificationOpen]);

  useEffect(() => {
    if (!notificationOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(event.target as Node)
      ) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationOpen]);

  useEffect(() => {
    if (!notificationOpen || isChat) return;
    setNotificationLoading(true);
    fetch('/api/admin/notifications/new-signups', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items != null) setNotificationItems(data.items);
      })
      .catch(() => {})
      .finally(() => setNotificationLoading(false));
  }, [notificationOpen, isChat]);

  useEffect(() => {
    if (!notificationOpen || !isChat) return;
    setNotificationLoading(true);
    const q = !isContractor && visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
    fetch(`/api/notifications/chat-unread-items${q}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items != null) setChatUnreadItems(data.items as ChatUnreadBellItem[]);
        else setChatUnreadItems([]);
      })
      .catch(() => setChatUnreadItems([]))
      .finally(() => setNotificationLoading(false));
  }, [notificationOpen, isChat, isContractor, visitorId]);

  return (
    <div className="relative z-[100] flex items-center shrink-0">
      <button
        ref={bellButtonRef}
        type="button"
        onClick={() => setNotificationOpen((o) => !o)}
        className="relative w-10 h-10 rounded-lg border-2 border-black bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors bell-shake-on-hover"
        aria-label="Notifications"
        aria-expanded={notificationOpen}
      >
        <Bell className="w-5 h-5 text-black" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 mt-0.5 ml-0.5 min-w-[18px] h-[18px] px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] md:text-[10px] font-bold text-center leading-none border-2 border-white -translate-x-[8px] translate-y-[4px]">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </button>

      {notificationOpen && menuBox && createPortal(
        <div
          ref={notificationRef}
          className="fixed w-72 bg-white rounded-lg border-2 border-black shadow-lg z-[300] overflow-hidden"
          style={{ top: menuBox.top, right: menuBox.right }}
        >
          {isChat ? (
            <>
              <div className="px-4 py-3 border-b-2 border-black bg-gray-50">
                <h3 className="text-sm font-bold text-black">Notifications</h3>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  ProBot messages
                </p>
              </div>
              <div className="max-h-[min(60vh,320px)] overflow-y-auto p-2">
                {notificationLoading && chatUnreadItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">Loading…</div>
                ) : chatUnreadItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">No new messages</div>
                ) : (
                  <ul className="space-y-0.5">
                    {chatUnreadItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/${locale}/probot?${item.probotHrefQuery}`}
                          onClick={() => setNotificationOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <span className="flex-shrink-0 w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                            <MessageCircle className="w-4 h-4 text-black" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-black truncate">{item.title}</span>
                            <span className="block text-[10px] text-gray-500 truncate">{item.preview}</span>
                            <span className="block text-[10px] text-gray-400 mt-0.5">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b-2 border-black bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-black">Notifications</h3>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Platform activity in the last 24 hours
                    </p>
                  </div>
                  {notificationCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      disabled={markingRead}
                      className="shrink-0 text-xs font-medium text-black underline hover:no-underline disabled:opacity-50 cursor-pointer"
                    >
                      {markingRead ? '…' : 'Mark all read'}
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[min(60vh,320px)] overflow-y-auto p-2">
                {notificationLoading && notificationItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    Loading…
                  </div>
                ) : notificationItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    No new activity
                  </div>
                ) : (
                  <ul className="space-y-0.5">
                    {notificationItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={() => setNotificationOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <span className="flex-shrink-0 w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                            <EventIcon item={item} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium truncate text-black">
                              {item.name}
                            </span>
                            <span className="block text-[10px] text-gray-500">
                              {eventSummary(item)} · {formatRelativeTime(item.createdAt)}
                            </span>
                            {item.detail ? (
                              <span className="block text-[10px] text-gray-400 truncate">{item.detail}</span>
                            ) : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
