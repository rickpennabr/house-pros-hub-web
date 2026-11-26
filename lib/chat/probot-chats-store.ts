'use client';

/**
 * ProBot chats (Gemini-style), shared by the sidebar list and the chat area.
 * One list per profile (personal or a business). `activeChatId` null = a new, empty chat
 * (the centered start screen); the chat row is created on its first message.
 */
import { useSyncExternalStore } from 'react';

export interface ProbotChatItem {
  id: string;
  title: string | null;
  updated_at: string;
  legacy?: boolean;
}

interface State {
  /** False until migration 180 is applied: the app keeps the single ProBot thread. */
  ready: boolean;
  loaded: boolean;
  chats: ProbotChatItem[];
  activeChatId: string | null;
  profile: string;
  conversationId: string | null;
  visitorId: string | null;
}

let state: State = {
  ready: false,
  loaded: false,
  chats: [],
  activeChatId: null,
  profile: 'personal',
  conversationId: null,
  visitorId: null,
};
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getState = () => state;

export function useProbotChats(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** The chat in the URL (?chat=…), so a refresh opens the same chat. */
function urlChat(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('chat');
}

function writeUrl(chatId: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (chatId) url.searchParams.set('chat', chatId);
  else url.searchParams.delete('chat');
  window.history.replaceState(window.history.state, '', url.toString());
}

/** Load the chats for this conversation and profile. A profile switch opens a new chat. */
export async function loadProbotChats(conversationId: string, visitorId: string, profile: string): Promise<void> {
  const changedProfile = state.profile !== profile || state.conversationId !== conversationId;
  set({ conversationId, visitorId, profile, ...(changedProfile ? { loaded: false, chats: [] } : {}) });
  try {
    const params = new URLSearchParams({ conversationId, visitorId, profile });
    const res = await fetch(`/api/chat/probot-chats?${params}`, { cache: 'no-store', credentials: 'include' });
    const data = (await res.json().catch(() => ({}))) as { chats?: ProbotChatItem[]; ready?: boolean };
    if (!res.ok) throw new Error('load');
    // Ignore an old answer after a quick profile switch.
    if (state.profile !== profile || state.conversationId !== conversationId) return;
    const chats = data.chats ?? [];
    const fromUrl = !state.loaded ? urlChat() : null;
    let activeChatId = changedProfile ? null : state.activeChatId;
    if (fromUrl && chats.some((chat) => chat.id === fromUrl)) activeChatId = fromUrl;
    if (activeChatId && !chats.some((chat) => chat.id === activeChatId)) activeChatId = null;
    set({ chats, ready: data.ready !== false, loaded: true, activeChatId });
    writeUrl(activeChatId);
  } catch {
    set({ loaded: true });
  }
}

export function selectProbotChat(chatId: string | null): void {
  set({ activeChatId: chatId });
  writeUrl(chatId);
}

/** "New chat": the centered start screen. */
export function startNewProbotChat(): void {
  selectProbotChat(null);
}

/** The chat a message goes into: the open one, or a new one created now (first message). */
export async function ensureProbotChat(): Promise<string | undefined> {
  if (!state.ready || !state.conversationId || !state.visitorId) return undefined;
  if (state.activeChatId === 'legacy') return undefined;
  if (state.activeChatId) return state.activeChatId;
  const res = await fetch('/api/chat/probot-chats', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: state.conversationId, visitorId: state.visitorId, profile: state.profile }),
  });
  const data = (await res.json().catch(() => ({}))) as { chat?: ProbotChatItem | null };
  if (!res.ok || !data.chat) return undefined;
  set({ chats: [data.chat, ...state.chats], activeChatId: data.chat.id });
  writeUrl(data.chat.id);
  return data.chat.id;
}

/** After a message: the chat moves to the top, with its new title. */
export function touchProbotChat(chatId: string, firstWords: string): void {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) return;
  const title = chat.title || firstWords || null;
  set({ chats: [{ ...chat, title, updated_at: new Date().toISOString() }, ...state.chats.filter((item) => item.id !== chatId)] });
}

export async function renameProbotChat(chatId: string, title: string): Promise<void> {
  const name = title.trim().slice(0, 120);
  if (!name || !state.conversationId || !state.visitorId) return;
  set({ chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, title: name } : chat)) });
  await fetch('/api/chat/probot-chats', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: state.conversationId, visitorId: state.visitorId, chatId, title: name }),
  }).catch(() => undefined);
}

export async function deleteProbotChat(chatId: string): Promise<void> {
  if (!state.conversationId || !state.visitorId) return;
  const params = new URLSearchParams({ conversationId: state.conversationId, visitorId: state.visitorId, chatId });
  const res = await fetch(`/api/chat/probot-chats?${params}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
  if (!res?.ok) return;
  set({ chats: state.chats.filter((chat) => chat.id !== chatId) });
  if (state.activeChatId === chatId) selectProbotChat(null);
}
