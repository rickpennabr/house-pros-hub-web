'use client';

import { useState } from 'react';
import { AudioLines, MoreVertical, Pencil, SquarePen, Trash2 } from 'lucide-react';
import { ProBotVoicePicker } from '@/components/probot/ProBotVoicePicker';
import { useProbotVoice } from '@/lib/chat/probot-voice-store';
import { probotVoice } from '@/lib/ai/voices';
import {
  deleteProbotChat,
  renameProbotChat,
  selectProbotChat,
  startNewProbotChat,
  useProbotChats,
} from '@/lib/chat/probot-chats-store';

/**
 * Under the ProBot row in the chats sidebar (Gemini-style): "New chat" and the person's ProBot chats
 * for the profile picked at the top. Each has ⋮ Rename / Delete.
 */
export function ProbotChatList({ onOpen }: { onOpen: () => void }) {
  const { ready, chats, activeChatId, elsewhere } = useProbotChats();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const voice = probotVoice(useProbotVoice());

  if (!ready) return null;

  return (
    <div className="border-b border-gray-100 px-2 pb-2">
      <button
        type="button"
        onClick={() => {
          startNewProbotChat();
          onOpen();
        }}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 ${
          activeChatId === null ? 'bg-gray-100' : ''
        }`}
      >
        <SquarePen className="h-4 w-4 shrink-0" aria-hidden />
        New chat
      </button>
      <button
        type="button"
        onClick={() => setVoiceOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-100"
      >
        <AudioLines className="h-4 w-4 shrink-0" aria-hidden />
        Voice
        <span className="ml-auto text-xs font-normal text-gray-500">{voice.name}</span>
      </button>
      <ProBotVoicePicker isOpen={voiceOpen} onClose={() => setVoiceOpen(false)} />
      {elsewhere > 0 ? (
        <p className="mx-1 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          New ProBot messages on your other profile. Switch profile at the top to see them.
        </p>
      ) : null}
      {chats.length > 0 ? <p className="px-3 pb-1 pt-2 text-xs font-medium text-gray-500">Chats</p> : null}
      <ul className="max-h-72 overflow-y-auto">
        {chats.map((chat) => {
          const title = chat.legacy ? 'Earlier chat' : chat.title || 'New chat';
          const active = activeChatId === chat.id;
          return (
            <li key={chat.id} className="relative">
              {renaming?.id === chat.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void renameProbotChat(chat.id, renaming.title);
                    setRenaming(null);
                  }}
                  className="px-1 py-0.5"
                >
                  <input
                    value={renaming.title}
                    onChange={(event) => setRenaming({ id: chat.id, title: event.target.value })}
                    onBlur={() => {
                      void renameProbotChat(chat.id, renaming.title);
                      setRenaming(null);
                    }}
                    onKeyDown={(event) => event.key === 'Escape' && setRenaming(null)}
                    maxLength={120}
                    autoFocus
                    aria-label="Chat name"
                    className="h-9 w-full rounded-lg border-2 border-black px-2 text-sm focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    selectProbotChat(chat.id);
                    onOpen();
                  }}
                  className={`flex w-full items-center rounded-lg py-2 pl-3 pr-9 text-left text-sm hover:bg-gray-100 ${
                    active ? 'bg-gray-200 font-medium text-gray-900' : 'text-gray-700'
                  }`}
                  title={title}
                >
                  <span className={`truncate ${chat.unread ? 'font-semibold text-black' : ''}`}>{title}</span>
                  {chat.unread ? <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="New messages" /> : null}
                </button>
              )}
              {renaming?.id === chat.id ? null : (
                <button
                  type="button"
                  onClick={() => setMenuId(menuId === chat.id ? null : chat.id)}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-black"
                  aria-label="Chat options"
                  aria-haspopup="menu"
                  aria-expanded={menuId === chat.id}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
              {menuId === chat.id ? (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuId(null)} aria-hidden />
                  <div role="menu" className="absolute right-1 top-full z-40 mt-1 w-40 overflow-hidden rounded-lg border-2 border-black bg-white py-1 shadow-lg">
                    {chat.legacy ? null : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuId(null);
                          setRenaming({ id: chat.id, title: chat.title ?? '' });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        <Pencil className="h-4 w-4" /> Rename
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuId(null);
                        setConfirmDelete(chat.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </>
              ) : null}
              {confirmDelete === chat.id ? (
                <div className="mx-1 mb-1 rounded-lg border-2 border-black bg-white p-2 text-sm">
                  <p className="mb-2">Delete this chat for good?</p>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setConfirmDelete(null)} className="h-8 rounded-lg border-2 border-black px-3 text-sm hover:bg-gray-50">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDelete(null);
                        void deleteProbotChat(chat.id);
                      }}
                      className="h-8 rounded-lg border-2 border-red-600 bg-red-600 px-3 text-sm text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
