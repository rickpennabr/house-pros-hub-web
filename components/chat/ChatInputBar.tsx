'use client';

import { type RefObject, type ChangeEvent } from 'react';
import { Plus, Paperclip, ImageIcon, Cloud, Send } from 'lucide-react';

export interface ChatInputBarLabels {
  attachFiles: string;
  uploadFiles: string;
  addFromGoogleDrive: string;
  photos: string;
  send: string;
}

export interface ChatInputBarProps {
  /** Class name for the outer row (e.g. "flex items-center gap-0 w-full" or with border/rounded). No gap between add button and input. */
  wrapperClassName: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  disabled?: boolean;
  maxLength?: number;
  inputRef?: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  attachMenuOpen: boolean;
  setAttachMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  attachDisabled?: boolean;
  sendDisabled: boolean;
  /** When true, send button gets has-text class for styling */
  hasText?: boolean;
  labels: ChatInputBarLabels;
}

/**
 * Reusable chat input row: hidden file input + attach button (with dropdown) + text input + send button.
 * Uses gap-0 between add button and input; send button has ml-2 for spacing.
 */
export default function ChatInputBar({
  wrapperClassName,
  value,
  onChange,
  placeholder,
  disabled = false,
  maxLength = 2000,
  inputRef,
  fileInputRef,
  onFileSelect,
  attachMenuOpen,
  setAttachMenuOpen,
  attachDisabled = false,
  sendDisabled,
  hasText = false,
  labels,
}: ChatInputBarProps) {
  return (
    <div className={wrapperClassName}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={onFileSelect}
      />
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setAttachMenuOpen((o) => !o)}
          disabled={attachDisabled}
          className="p-2.5 rounded-full text-black hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer hover:animate-pulse"
          aria-label={labels.attachFiles}
          aria-expanded={attachMenuOpen}
        >
          <Plus className="w-5 h-5" />
        </button>
        {attachMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              aria-hidden
              onClick={() => setAttachMenuOpen(false)}
            />
            <div className="absolute bottom-full left-0 mb-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-20">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setAttachMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
                {labels.uploadFiles}
              </button>
              <a
                href="https://drive.google.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAttachMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                {labels.addFromGoogleDrive}
              </a>
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setAttachMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                {labels.photos}
              </button>
            </div>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full py-3 text-base md:text-[14.4px] chat-input-bar-input bg-transparent border-0 focus:outline-none focus:ring-0 text-black placeholder:text-black placeholder:text-base md:placeholder:text-[14.4px]"
          disabled={disabled}
          maxLength={maxLength}
        />
      </div>
      <button
        type="submit"
        disabled={sendDisabled}
        className={`send-button-plane p-2.5 rounded-lg bg-black text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors overflow-visible ml-2 ${hasText ? 'has-text' : ''}`}
        aria-label={labels.send}
      >
        <span className="send-plane-icon inline-block text-white">
          <Send className="w-5 h-5" stroke="currentColor" />
        </span>
      </button>
    </div>
  );
}
