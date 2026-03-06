'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Send, MessageCircle, Volume2, VolumeX, Bell, BellOff, Trash2, Plus, Paperclip, ImageIcon, Cloud, User } from 'lucide-react';
import { playNotificationSound } from '@/lib/utils/notificationSound';
import { PROBOT_ASSETS } from '@/lib/constants/probot';

interface Conversation {
  id: string;
  visitor_id: string;
  created_at: string;
  updated_at: string;
  lastMessage: { body: string; created_at: string; sender: string } | null;
  last_seen_at?: string | null;
  visitor_online?: boolean;
}

interface ChatAttachment {
  url: string;
  name: string;
  contentType: string;
}

interface ChatMessage {
  id: string;
  sender: 'visitor' | 'admin';
  body: string;
  created_at: string;
  business_id?: string;
  business_name?: string;
  read_at?: string;
  attachments?: ChatAttachment[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

const ADMIN_HEARTBEAT_MS = 35_000;
const VISITOR_PRESENCE_POLL_MS = 45_000;

export default function AdminChatPage() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushRegistering, setPushRegistering] = useState(false);
  const [selectedVisitorOnline, setSelectedVisitorOnline] = useState<boolean | null>(null);
  const [clearing, setClearing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const vapidPublicKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : null;

  const registerPush = useCallback(async () => {
    if (!vapidPublicKey || pushRegistering || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushRegistering(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await reg.update();
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushEnabled(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const payload = sub.toJSON();
      const res = await fetch('/api/chat/admin/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: payload.endpoint, keys: payload.keys }),
      });
      setPushEnabled(res.ok);
    } catch {
      setPushEnabled(false);
    } finally {
      setPushRegistering(false);
    }
  }, [vapidPublicKey, pushRegistering]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPushEnabled(Notification.permission === 'granted');
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/admin/conversations');
      if (!res.ok) return;
      const data = await res.json();
      const list = data.conversations ?? [];
      setConversations(list);
      // If URL has conversationId, select that conversation (e.g. from ProBot sidebar "History Chat")
      const fromUrl = searchParams.get('conversationId');
      if (fromUrl && list.some((c: Conversation) => c.id === fromUrl)) {
        setSelectedId(fromUrl);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 50_000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    const heartbeat = () => {
      fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'admin' }),
      }).catch(() => {});
    };
    heartbeat();
    const interval = setInterval(heartbeat, ADMIN_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, []);

  const selectedConv = conversations.find((c) => c.id === selectedId);
  useEffect(() => {
    if (!selectedId || !selectedConv) {
      setSelectedVisitorOnline(null);
      return;
    }
    setSelectedVisitorOnline(selectedConv.visitor_online ?? false);
    const fetchVisitorPresence = () => {
      fetch(`/api/chat/presence?visitorId=${encodeURIComponent(selectedConv.visitor_id)}`)
        .then((res) => (res.ok ? res.json() : { online: false }))
        .then((data) => setSelectedVisitorOnline(data.online === true))
        .catch(() => setSelectedVisitorOnline(false));
    };
    fetchVisitorPresence();
    const interval = setInterval(fetchVisitorPresence, VISITOR_PRESENCE_POLL_MS);
    return () => clearInterval(interval);
  }, [selectedId, selectedConv?.visitor_id]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedId);
  }, [selectedId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime: new messages (play sound when visitor sends)
  useEffect(() => {
    const channel = supabase
      .channel('probot_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'probot_messages' },
        (payload) => {
          const row = payload.new as { sender?: string; conversation_id?: string };
          if (row.sender === 'visitor') {
            if (soundEnabled) playNotificationSound();
            if (row.conversation_id === selectedId) {
              fetchMessages(selectedId);
            } else {
              fetchConversations();
            }
          } else if (row.sender === 'admin' && row.conversation_id === selectedId) {
            fetchMessages(selectedId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, soundEnabled, supabase, fetchMessages, fetchConversations]);

  const handleClearHistory = useCallback(async () => {
    if (!selectedId || clearing) return;
    const clearThis = confirm('Clear this conversation? All messages will be permanently deleted.');
    if (!clearThis) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/chat/admin/conversations/delete?conversationId=${encodeURIComponent(selectedId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to clear chat');
        return;
      }
      setSelectedId(null);
      setMessages([]);
      setReply('');
      await fetchConversations();
    } finally {
      setClearing(false);
    }
  }, [selectedId, clearing, fetchConversations]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasContent = reply.trim() || pendingAttachments.length > 0;
    if (!selectedId || !hasContent || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedId,
          body: reply.trim() || ' ',
          ...(pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) setMessages((prev) => [...prev, { ...data.message, attachments: data.message.attachments ?? [] }]);
        setReply('');
        setPendingAttachments([]);
      }
    } finally {
      setSending(false);
    }
  };

  const handleAdminFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || !selectedId) return;
      if (pendingAttachments.length + files.length > 10) {
        e.target.value = '';
        return;
      }
      setUploadingAttach(true);
      try {
        const formData = new FormData();
        formData.set('conversationId', selectedId);
        formData.set('visitorId', 'admin');
        for (let i = 0; i < files.length; i++) formData.append('file', files[i]);
        const res = await fetch('/api/storage/upload-chat-attachment', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.attachments?.length)
          setPendingAttachments((prev) => [...prev, ...data.attachments].slice(0, 10));
      } finally {
        setUploadingAttach(false);
        e.target.value = '';
      }
    },
    [selectedId, pendingAttachments.length]
  );

  const selected = selectedConv;

  return (
    <div className="flex flex-col h-full min-h-0">
      <h1 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <MessageCircle className="w-6 h-6" />
        ProBot Chat
      </h1>
      <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-4 border border-gray-200 rounded-lg overflow-hidden bg-white">
        <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col min-h-0">
          <div className="p-2 flex items-center justify-between border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Conversations</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSoundEnabled((s) => !s)}
                className="p-2 rounded hover:bg-gray-100"
                title={soundEnabled ? 'Mute new message sound' : 'Unmute'}
                aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
              </button>
              {vapidPublicKey && (
                <button
                  type="button"
                  onClick={registerPush}
                  disabled={pushRegistering || pushEnabled === true}
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-60 cursor-pointer"
                  title={pushEnabled ? 'Push notifications enabled' : 'Enable push notifications'}
                  aria-label={pushEnabled ? 'Push enabled' : 'Enable push'}
                >
                  {pushEnabled ? <Bell className="w-4 h-4 text-green-600" /> : <BellOff className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
          {vapidPublicKey && pushEnabled !== true && (
            <p className="px-2 pb-2 text-xs text-gray-500 border-b border-gray-100">
              Tap the bell above to get notifications on this device when visitors send messages.
            </p>
          )}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-gray-500">Loading...</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No conversations yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-start gap-2 ${selectedId === c.id ? 'bg-gray-100' : ''}`}
                    >
                      {c.visitor_online !== undefined && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${c.visitor_online ? 'bg-green-500' : 'bg-gray-400'}`}
                          title={c.visitor_online ? 'Online' : 'Offline'}
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 truncate">Visitor {c.visitor_id.slice(0, 8)}…</p>
                        {c.lastMessage && (
                          <p className="text-sm text-gray-700 truncate mt-0.5">{c.lastMessage.body}</p>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        <section className="flex-1 flex flex-col min-h-0 min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="shrink-0 px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm text-gray-600 truncate">Conversation with visitor {selected.visitor_id.slice(0, 8)}…</p>
                  {selectedVisitorOnline !== null && (
                    <>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${selectedVisitorOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                        aria-hidden
                      />
                      <span className="text-xs text-gray-500 shrink-0">{selectedVisitorOnline ? 'Online' : 'Offline'}</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={clearing}
                  className="shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Clear chat history"
                  aria-label="Clear chat history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-end gap-2 max-w-[85%] ${m.sender === 'admin' ? 'self-end flex-row-reverse' : 'self-start'}`}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gray-200 ring-2 ring-white shadow flex items-center justify-center">
                      {m.sender === 'admin' ? (
                        <Image
                          src={PROBOT_ASSETS.avatar}
                          alt="ProBot"
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4 text-gray-500" aria-hidden />
                      )}
                    </div>
                    <div
                      className={`rounded-lg px-3 py-2 min-w-0 ${
                        m.sender === 'admin'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-xs font-medium opacity-80 mb-1">
                        {m.sender === 'admin' ? 'ProBot' : m.business_name ? `Customer · To: ${m.business_name}` : 'Customer'}
                      </p>
                      {m.body.trim() && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                      {m.attachments?.length ? (
                        <div className="mt-2 space-y-2">
                          {m.attachments.map((att: ChatAttachment, i: number) =>
                            att.contentType.startsWith('image/') ? (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden max-w-[240px] border border-gray-200">
                                <img src={att.url} alt={att.name} className="w-full h-auto object-cover" />
                              </a>
                            ) : (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm underline">
                                <Paperclip className="w-4 h-4 shrink-0" />
                                {att.name}
                              </a>
                            )
                          )}
                        </div>
                      ) : null}
                      <p className="text-xs opacity-70 mt-1">{formatTime(m.created_at)}</p>
                      {m.read_at && (
                        <p className="text-xs opacity-60 mt-0.5">
                          {m.sender === 'visitor' ? 'Seen by you at ' : 'Seen by customer at '}
                          {formatTime(m.read_at)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form
                onSubmit={handleSendReply}
                className="shrink-0 p-3 border-t border-gray-200 flex flex-col gap-2"
              >
                {pendingAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingAttachments.map((att, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm">
                        {att.contentType.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                        <span className="max-w-[120px] truncate">{att.name}</span>
                        <button type="button" onClick={() => setPendingAttachments((p) => p.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500">Replying as ProBot</p>
                <div className="flex gap-2 items-end">
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleAdminFileSelect} />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAttachMenuOpen((o) => !o)}
                      disabled={uploadingAttach || pendingAttachments.length >= 10}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-50"
                      aria-label="Attach files"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {attachMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setAttachMenuOpen(false)} />
                        <div className="absolute bottom-full left-0 mb-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-20">
                          <button type="button" onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <Paperclip className="w-4 h-4" /> Upload files
                          </button>
                          <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer" onClick={() => setAttachMenuOpen(false)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <Cloud className="w-4 h-4" /> Add from Google Drive
                          </a>
                          <button type="button" onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <ImageIcon className="w-4 h-4" /> Photos
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply..."
                    rows={1}
                    disabled={sending}
                    className="flex-1 min-h-[44px] max-h-32 py-3 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                    aria-label="Reply"
                  />
                  <button
                    type="submit"
                    disabled={sending || (!reply.trim() && pendingAttachments.length === 0)}
                    className="shrink-0 w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 disabled:opacity-60 min-w-[48px] min-h-[48px] cursor-pointer"
                    aria-label="Send"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
