'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, MessageCircle, Users, Building2, User, Search, X } from 'lucide-react';
import { PROBOT_ASSETS } from '@/lib/constants/probot';

export interface ProBotContact {
  id: string;
  name: string;
  isProBot: boolean;
  businessId?: string;
  slug?: string;
  /** Logo URL for display in sidebar (business logo or ProBot image path) */
  logo?: string;
  /** Online status for business contacts; ProBot is always online */
  online?: boolean;
  /** When set, this contact is a customer (admin/contractor view); open this conversation when selected */
  conversationId?: string;
  visitorId?: string;
  /** Customer contact avatar from profile */
  profile_user_picture?: string | null;
}

/** Admin conversation list item (from GET /api/chat/admin/conversations). Only includes conversations where admin (ProBot) sent or received a message. */
export interface ProBotRecentConversation {
  id: string;
  visitor_id: string;
  lastMessage: { body: string; created_at: string; sender: string } | null;
  /** First message sent by the visitor (customer/contractor) – shown as preview in History Chat */
  firstVisitorMessage?: { body: string; created_at: string } | null;
  /** Number of visitor messages not yet read by admin (WhatsApp-style badge) */
  unread_count?: number;
  updated_at: string;
  visitor_online?: boolean;
  /** 'customer' | 'contractor' - contractor when any message in the thread was to/from a business */
  participant_type?: 'customer' | 'contractor';
  /** Set when participant_type is 'contractor' */
  business_name?: string;
  /** Business ID when participant_type is 'contractor' (for Reply as Business) */
  business_id?: string;
  /** Business logo URL when participant_type is 'contractor' */
  business_logo?: string | null;
  /** Real name when known (e.g. from signup or when sent with a message) */
  visitor_display_name?: string | null;
  /** From profiles when conversation.user_id is set */
  profile_first_name?: string | null;
  profile_last_name?: string | null;
  profile_user_picture?: string | null;
  /** When true, the visitor is the current admin—show as ProBot only, never personal name */
  display_as_probot?: boolean;
}

const COLLAPSED_WIDTH = 52;
const EXPANDED_WIDTH = 256;

/** Format ISO date as WhatsApp-style time (e.g. "6:43 PM") or relative day for older. */
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const then = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - then.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ProBotSidebarProps {
  contacts: ProBotContact[];
  selectedContactId: string;
  onSelectContact: (contact: ProBotContact) => void;
  /** When true/false, show online/offline next to ProBot contact; undefined = hide indicator */
  hubOnline?: boolean | null;
  /** When admin: recent conversations (customer messages) to show in History Chat; enables history list */
  recentConversations?: ProBotRecentConversation[] | null;
  /** When admin clicks a history item: which conversation is selected (show in chat area) */
  selectedConversationIdForAdmin?: string | null;
  /** When admin clicks a history item, call with conversation id (stay on page, load in chat area) */
  onSelectConversation?: (conversationId: string) => void;
  /** When admin: number of conversations with unread (new) messages; badge shown on History Chat */
  unreadCount?: number;
  /** When admin: conversation ids that have unread messages; show dot per item in History list */
  unreadConversationIds?: Set<string>;
  /** When visitor (not admin): the ProBot conversation to show in History (ProBot logo + name) */
  visitorProBotConversation?: { id: string; preview?: string; lastMessageTime?: string; unread?: boolean; unreadCount?: number } | null;
  /** When visitor: total unread count for ProBot (so collapsed icon badge shows even when visitorProBotConversation is null) */
  visitorUnreadCount?: number;
  /** When visitor clicks the ProBot history item */
  onSelectVisitorProBot?: () => void;
  /** When true, show skeleton loaders in History Chat (admin list loading) */
  historyChatLoading?: boolean;
  /** When provided, sidebar open state is controlled by parent (e.g. so ChatArea can open sidebar) */
  sidebarOpen?: boolean;
  /** Called when sidebar open state should change (use with sidebarOpen for controlled mode) */
  onSidebarOpenChange?: (open: boolean) => void;
  /** When true and mobile, hide the expand-sidebar tab (layout shows back chevron to welcome instead) */
  inChatView?: boolean;
}

export default function ProBotSidebar({
  contacts,
  selectedContactId,
  onSelectContact,
  hubOnline,
  recentConversations,
  selectedConversationIdForAdmin,
  onSelectConversation,
  unreadCount = 0,
  unreadConversationIds,
  visitorProBotConversation,
  visitorUnreadCount = 0,
  onSelectVisitorProBot,
  historyChatLoading = false,
  sidebarOpen: controlledSidebarOpen,
  onSidebarOpenChange,
  inChatView = false,
}: ProBotSidebarProps) {
  const t = useTranslations('probot');
  // Start collapsed so mobile loads with sidebar closed; desktop expands after mount (see effect).
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const isControlled = controlledSidebarOpen !== undefined && onSidebarOpenChange !== undefined;
  const sidebarOpen = isControlled ? controlledSidebarOpen : internalSidebarOpen;
  const setSidebarOpen = isControlled ? onSidebarOpenChange! : setInternalSidebarOpen;
  const [contactsOpen, setContactsOpen] = useState(true);
  // Single search bar at top (mobile and desktop); filters both history and contacts.
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile (sidebar hidden by default; show tab to open). Desktop: sidebar visible.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // On desktop (md and up), expand sidebar after mount. Mobile stays collapsed (tab to open).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) setSidebarOpen(true);
  }, []);

  const qContacts = sidebarSearchQuery.trim().toLowerCase();
  const filteredContacts = useMemo(() => {
    if (!qContacts) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(qContacts));
  }, [contacts, qContacts]);

  // Only expand on hover on desktop (md+). On mobile, no hover—expand only via chevron tap.
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop && e.pointerType === 'mouse' && !sidebarOpen) setSidebarOpen(true);
  };

  // Badge on collapsed message icon: admin uses unreadCount; visitor uses visitorUnreadCount or visitorProBotConversation
  const collapsedMessageBadgeCount =
    unreadCount > 0
      ? unreadCount
      : visitorUnreadCount > 0
        ? visitorUnreadCount
        : visitorProBotConversation
          ? visitorProBotConversation.unreadCount ?? (visitorProBotConversation.unread ? 1 : 0)
          : 0;

  return (
    <>
      {/* Mobile: small tab on left edge to open sidebar; hide when in chat (layout shows back chevron to welcome instead) */}
      {isMobile && !sidebarOpen && !inChatView && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-0 top-[60px] z-40 w-7 h-[60px] rounded-r-md bg-white border-2 border-black border-l-0 flex items-center justify-center text-black shadow-md touch-manipulation"
          aria-label={t('expandSidebar')}
          title={t('expandSidebar')}
        >
          <ChevronRight className="w-4 h-4 text-black" aria-hidden />
        </button>
      )}
      {/* Mobile: backdrop when sidebar is open; tap to close (full height when sidebar is full height) */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed left-[256px] right-0 top-0 bottom-0 z-40 md:hidden bg-black/40"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={`flex flex-col border-r bg-white shrink-0 transition-[width] duration-200 ease-out relative ${
          isMobile && sidebarOpen ? 'border-black' : 'border-gray-200'
        } ${sidebarOpen ? 'overflow-hidden' : 'overflow-visible'} ${
          isMobile && !sidebarOpen ? 'w-0 min-w-0 overflow-hidden' : ''
        } ${
          isMobile && sidebarOpen ? 'fixed left-0 top-0 bottom-0 z-50 w-[256px] shadow-xl border-r-2 border-t-2 border-b-2' : ''
        }`}
        style={
          !isMobile
            ? { width: sidebarOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH }
            : isMobile && sidebarOpen
              ? undefined
              : { width: 0 }
        }
        onPointerEnter={handlePointerEnter}
      >
      {/* PC: collapse tab on right edge when sidebar is expanded */}
      {!isMobile && sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-full w-7 h-14 flex items-center justify-center rounded-r-md bg-white border-2 border-black border-l-0 text-black shadow-md hover:bg-gray-50 transition-colors cursor-pointer"
          aria-label={t('collapseSidebar')}
          title={t('collapseSidebar')}
        >
          <ChevronLeft className="w-4 h-4 text-black" aria-hidden />
        </button>
      )}
      {/* PC: expand tab on right edge when sidebar is collapsed */}
      {!isMobile && !sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-full w-7 h-14 flex items-center justify-center rounded-r-md bg-white border-2 border-black border-l-0 text-black shadow-md hover:bg-gray-50 transition-colors cursor-pointer"
          aria-label={t('expandSidebar')}
          title={t('expandSidebar')}
        >
          <ChevronRight className="w-4 h-4 text-black" aria-hidden />
        </button>
      )}

      {/* When mobile and sidebar closed, render nothing (tab only). Otherwise show content (no "Chat" header; search bar first when open). */}
      {(!isMobile || sidebarOpen) && (
      <>
      {!sidebarOpen && (
        <div className="flex flex-col items-center py-3 gap-4 flex-1 min-h-0 overflow-visible">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="relative flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors"
            title={t('contacts')}
            aria-label={t('contacts')}
          >
            <MessageCircle className="w-5 h-5" aria-hidden />
            {collapsedMessageBadgeCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold shadow-sm ring-2 ring-white z-10"
                aria-label={collapsedMessageBadgeCount === 1 ? '1 unread message' : `${collapsedMessageBadgeCount} unread messages`}
              >
                {collapsedMessageBadgeCount > 99 ? '99+' : collapsedMessageBadgeCount}
              </span>
            )}
          </button>
        </div>
      )}

      {sidebarOpen && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Search bar at top - mobile and PC when sidebar is expanded */}
          <div className="shrink-0 min-h-[60px] w-full pl-2 pr-2 pt-3 pb-2 flex items-center justify-center border-b-2 border-black bg-white">
            <div className="relative w-full min-w-0 flex items-center">
              <input
                ref={sidebarSearchInputRef}
                type="text"
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                placeholder={t('searchContacts')}
                className="w-full h-10 min-w-0 pl-9 pr-8 border-2 border-black rounded-lg bg-white text-gray-900 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                aria-label={t('searchContacts')}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              {sidebarSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSidebarSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                  aria-label={t('closeSearch')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Contacts list; on mobile search bar at top filters contacts */}
          <div className="flex flex-col flex-1 min-h-0 flex overflow-hidden">
            {(contactsOpen || isMobile) && (
              <div className="flex-1 overflow-y-auto py-1 px-1">
                {filteredContacts.map((contact) => {
                  const isSelected = selectedContactId === contact.id;
                  // Business contacts: logo only (never pro personal photo). Customer contacts: profile picture or logo.
                  const logoSrc = contact.isProBot ? PROBOT_ASSETS.avatar : (contact.businessId ? contact.logo : (contact.logo ?? contact.profile_user_picture ?? undefined));
                  const isCustomerContact = contact.conversationId != null;
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => onSelectContact(contact)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors cursor-pointer ${
                        isSelected ? 'bg-gray-900 text-white' : 'md:hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-white relative">
                        {logoSrc ? (
                          contact.isProBot ? (
                            <Image
                              src={logoSrc}
                              alt=""
                              width={32}
                              height={32}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <img
                              src={logoSrc}
                              alt=""
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : (
                          isCustomerContact ? (
                            <User className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} aria-hidden />
                          ) : (
                            <Building2
                              className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`}
                            />
                          )
                        )}
                      </div>
                      <span className="text-sm font-medium truncate flex-1">
                        {contact.name}
                      </span>
                      {contact.isProBot && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 bg-green-500 ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''}`}
                          title={t('online')}
                          aria-hidden
                        />
                      )}
                      {!contact.isProBot && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            contact.online ? 'bg-green-500' : 'bg-gray-400'
                          } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''}`}
                          title={contact.online ? t('online') : t('offline')}
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
      {/* Mobile: collapse tab outside sidebar, aligned with search bar (below 60px header) */}
      {isMobile && sidebarOpen && selectedContactId === 'probot' && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed left-[256px] top-[60px] z-[60] w-7 h-[64px] min-h-[64px] rounded-r-md bg-white border-2 border-black border-l-0 flex items-center justify-center text-black shadow-md touch-manipulation md:hidden"
          aria-label={t('collapseSidebar')}
          title={t('collapseSidebar')}
        >
          <ChevronLeft className="w-4 h-4 text-black" aria-hidden />
        </button>
      )}
    </>
  );
}
