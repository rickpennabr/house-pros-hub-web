'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, MessageCircle, Volume2, VolumeX, Bell, BellOff } from 'lucide-react';

interface Conversation {
  id: string;
  visitor_id: string;
  created_at: string;
  updated_at: string;
  lastMessage: { body: string; created_at: string; sender: string } | null;
}

interface ChatMessage {
  id: string;
  sender: 'visitor' | 'admin';
  body: string;
  created_at: string;
  business_id?: string;
  business_name?: string;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore
  }
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

export default function AdminChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushRegistering, setPushRegistering] = useState(false);
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
      setConversations(data.conversations ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [fetchConversations]);

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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, body: reply.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) setMessages((prev) => [...prev, data.message]);
        setReply('');
      }
    } finally {
      setSending(false);
    }
  };

  const selected = conversations.find((c) => c.id === selectedId);

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
                  className="p-2 rounded hover:bg-gray-100 disabled:opacity-60"
                  title={pushEnabled ? 'Push notifications enabled' : 'Enable push notifications'}
                  aria-label={pushEnabled ? 'Push enabled' : 'Enable push'}
                >
                  {pushEnabled ? <Bell className="w-4 h-4 text-green-600" /> : <BellOff className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
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
                      className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${selectedId === c.id ? 'bg-gray-100' : ''}`}
                    >
                      <p className="text-xs text-gray-500 truncate">Visitor {c.visitor_id.slice(0, 8)}…</p>
                      {c.lastMessage && (
                        <p className="text-sm text-gray-700 truncate mt-0.5">{c.lastMessage.body}</p>
                      )}
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
              <div className="shrink-0 px-4 py-2 border-b border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">Conversation with visitor {selected.visitor_id.slice(0, 8)}…</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      m.sender === 'admin'
                        ? 'self-end bg-gray-900 text-white'
                        : 'self-start bg-gray-100 text-gray-900'
                    }`}
                  >
                    {m.sender === 'visitor' && m.business_name && (
                      <p className="text-xs font-medium opacity-80 mb-1">To: {m.business_name}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="text-xs opacity-70 mt-1">{formatTime(m.created_at)}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form
                onSubmit={handleSendReply}
                className="shrink-0 p-3 border-t border-gray-200 flex gap-2 items-end"
              >
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
                  disabled={sending || !reply.trim()}
                  className="shrink-0 w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 disabled:opacity-60 min-w-[48px] min-h-[48px]"
                  aria-label="Send"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
