'use client';

import { type ChangeEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { Camera, Cloud, ImageIcon, Mic, Paperclip, Plus, Send, Square } from 'lucide-react';

export interface ChatInputBarLabels {
  attachFiles: string;
  uploadFiles: string;
  addFromGoogleDrive: string;
  photos: string;
  camera: string;
  voiceNote: string;
  stopVoice: string;
  voiceDenied: string;
  replyingTo: string;
  cancelReply: string;
  send: string;
}

export interface ChatInputBarProps {
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
  hasText?: boolean;
  labels: ChatInputBarLabels;
  replyPreview?: string | null;
  onCancelReply?: () => void;
  onRecorderError?: (message: string) => void;
}

function fileEvent(file: File): ChangeEvent<HTMLInputElement> {
  const input = document.createElement('input');
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  return { target: input, currentTarget: input } as ChangeEvent<HTMLInputElement>;
}

function openPicker(input: HTMLInputElement | null, accept: string, capture: boolean) {
  if (!input) return;
  input.accept = accept;
  if (capture) input.setAttribute('capture', 'environment');
  else input.removeAttribute('capture');
  input.click();
}

/**
 * Chat row: attach menu (files, camera, photos and video), voice note, text, send.
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
  replyPreview,
  onCancelReply,
  onRecorderError,
}: ChatInputBarProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    };
  }, []);

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const startRecording = async () => {
    if (attachDisabled || recording || !navigator.mediaDevices?.getUserMedia) {
      onRecorderError?.(labels.voiceDenied);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const rawType = recorder.mimeType || 'audio/webm';
        const type = rawType.split(';')[0] || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File(chunksRef.current, `voice-note-${Date.now()}.${ext}`, { type });
        if (file.size > 0) onFileSelect(fileEvent(file));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      onRecorderError?.(labels.voiceDenied);
      setRecording(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      {replyPreview ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-black/20 bg-white px-3 py-1.5 text-xs text-black">
          <span className="min-w-0 truncate">
            {labels.replyingTo}: {replyPreview}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 cursor-pointer text-base leading-none text-black"
            aria-label={labels.cancelReply}
          >
            ×
          </button>
        </div>
      ) : null}
      <div className={wrapperClassName}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf"
          multiple
          className="hidden"
          onChange={onFileSelect}
        />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAttachMenuOpen((open) => !open)}
            disabled={attachDisabled}
            className="cursor-pointer rounded-full p-2.5 text-black transition-colors hover:animate-pulse hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={labels.attachFiles}
            aria-expanded={attachMenuOpen}
          >
            <Plus className="h-5 w-5" />
          </button>
          {attachMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setAttachMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    openPicker(fileInputRef.current, 'image/*,video/*,application/pdf', false);
                    setAttachMenuOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Paperclip className="h-4 w-4" />
                  {labels.uploadFiles}
                </button>
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAttachMenuOpen(false)}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Cloud className="h-4 w-4" />
                  {labels.addFromGoogleDrive}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    openPicker(fileInputRef.current, 'image/*,video/*', true);
                    setAttachMenuOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Camera className="h-4 w-4" />
                  {labels.camera}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openPicker(fileInputRef.current, 'image/*,video/*', false);
                    setAttachMenuOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ImageIcon className="h-4 w-4" />
                  {labels.photos}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="chat-input-bar-input w-full border-0 bg-transparent py-3 text-base text-black placeholder:text-base placeholder:text-black focus:outline-none focus:ring-0"
            disabled={disabled}
            maxLength={maxLength}
          />
        </div>
        <button
          type="button"
          onClick={() => (recording ? stopRecording() : void startRecording())}
          disabled={attachDisabled}
          className={`mr-1 shrink-0 cursor-pointer rounded-lg p-2.5 disabled:cursor-not-allowed disabled:opacity-50 ${
            recording ? 'bg-red-600 text-white' : 'text-black'
          }`}
          aria-label={recording ? labels.stopVoice : labels.voiceNote}
          title={recording ? labels.stopVoice : labels.voiceNote}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          type="submit"
          disabled={sendDisabled}
          className={`send-button-plane ml-1 flex shrink-0 cursor-pointer items-center justify-center overflow-visible rounded-lg bg-black p-2.5 text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 ${hasText ? 'has-text' : ''}`}
          aria-label={labels.send}
        >
          <span className="send-plane-icon inline-block text-white">
            <Send className="h-5 w-5" stroke="currentColor" />
          </span>
        </button>
      </div>
    </div>
  );
}
