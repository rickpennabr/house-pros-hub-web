'use client';

import { type ChangeEvent, type ClipboardEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { WebcamCapture } from '@/components/media/WebcamCapture';
import { dropFilesIntoInput, fileMatchesAccept, useFileDrop } from '@/hooks/useFileDrop';
import { CHAT_ATTACHMENT_ACCEPT } from '@/lib/utils/chatAttachmentAccept';
import { FileUp, Camera, Cloud, ImageIcon, Mic, Pause, Paperclip, Play, Plus, Send, Trash2 } from 'lucide-react';

const WAVE_BARS = 32;

/** 0:07, 1:23 */
function recordingTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface ChatInputBarLabels {
  /** Shown in the tall drop area while files are dragged over the box. */
  dropFiles?: string;
  attachFiles: string;
  uploadFiles: string;
  addFromGoogleDrive: string;
  photos: string;
  camera: string;
  voiceNote: string;
  stopVoice: string;
  voiceDenied: string;
  /** Trash button while recording (discard the voice note). */
  cancelVoice?: string;
  /** Read by screen readers while recording. */
  recordingVoice?: string;
  /** The recorder gave back no audio. */
  voiceEmpty?: string;
  pauseVoice?: string;
  resumeVoice?: string;
  playVoice?: string;
  sendVoice?: string;
  /** No microphone plugged in or turned on (permission is fine). */
  voiceNoMic?: string;
  /** Another app is using the microphone. */
  voiceBusy?: string;
  /** The browser cannot record audio here (old browser or not https). */
  voiceUnsupported?: string;
  replyingTo: string;
  cancelReply: string;
  send: string;
}

export interface ChatInputBarCrmAction {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
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
  /** Extra + menu actions (CRM share tools for contractors). */
  crmActions?: ChatInputBarCrmAction[];
  /** Files waiting to send, shown inside the box above the text row. */
  attachments?: ReactNode;
  replyPreview?: string | null;
  onCancelReply?: () => void;
  onRecorderError?: (message: string) => void;
  /** Send a finished voice note straight to the chat (upload + send). Without it the note is attached like a file. */
  onSendVoice?: (file: File) => void | Promise<void>;
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
  crmActions,
  attachments,
  replyPreview,
  onCancelReply,
  onRecorderError,
  onSendVoice,
}: ChatInputBarProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // WhatsApp-style voice note: record, pause to listen, resume, then delete or send.
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'paused'>('idle');
  /** PC: Camera opens the webcam (a phone uses its own camera app through the file input). */
  const [webcamOpen, setWebcamOpen] = useState(false);
  const recording = voiceState !== 'idle';
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  /** What to do with the audio when the recorder stops. */
  const finishRef = useRef<'send' | 'discard'>('discard');
  const elapsedRef = useRef(0);
  const meterRef = useRef<{ ctx: AudioContext | null; timer: number; copy: MediaStream | null } | null>(null);

  const clearPreview = () => {
    previewRef.current?.pause();
    setPreviewPlaying(false);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  };

  const stopMeter = () => {
    const meter = meterRef.current;
    meterRef.current = null;
    if (!meter) return;
    window.clearInterval(meter.timer);
    meter.copy?.getTracks().forEach((track) => track.stop());
    void meter.ctx?.close().catch(() => undefined);
  };

  /** Timer and live wave. The wave listens to a copy of the mic so the recording itself is never touched. */
  const startMeter = (stream: MediaStream) => {
    const resumedAt = Date.now();
    const base = elapsedRef.current;
    let analyser: AnalyserNode | null = null;
    let ctx: AudioContext | null = null;
    let copy: MediaStream | null = null;
    try {
      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        ctx = new Ctor();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        copy = stream.clone();
        ctx.createMediaStreamSource(copy).connect(analyser);
      }
    } catch {
      analyser = null;
    }
    const data = analyser ? new Uint8Array(analyser.fftSize) : null;
    const timer = window.setInterval(() => {
      elapsedRef.current = base + (Date.now() - resumedAt) / 1000;
      setRecordSeconds(Math.floor(elapsedRef.current));
      let level = 0.15 + Math.random() * 0.2;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        level = Math.min(1, 0.08 + (peak / 128) * 1.6);
      }
      setLevels((prev) => [...prev.slice(-(WAVE_BARS - 1)), level]);
    }, 120);
    meterRef.current = { ctx, timer, copy };
  };

  const audioType = () => {
    const rawType = recorderRef.current?.mimeType || 'audio/webm';
    return rawType.split(';')[0] || 'audio/webm';
  };

  useEffect(() => {
    return () => {
      stopMeter();
      finishRef.current = 'discard';
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    };
  }, []);

  const startRecording = async () => {
    if (attachDisabled || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onRecorderError?.(labels.voiceUnsupported ?? labels.voiceDenied);
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
        stopMeter();
        clearPreview();
        setVoiceState('idle');
        const finish = finishRef.current;
        finishRef.current = 'discard';
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (finish !== 'send') return;
        const type = (recorder.mimeType || 'audio/webm').split(';')[0] || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File(chunks, `voice-note-${Date.now()}.${ext}`, { type });
        if (file.size === 0) {
          onRecorderError?.(labels.voiceEmpty ?? 'The recording came out empty. Please try again.');
          return;
        }
        if (onSendVoice) void onSendVoice(file);
        else onFileSelect(fileEvent(file));
      };
      recorderRef.current = recorder;
      finishRef.current = 'discard';
      elapsedRef.current = 0;
      setRecordSeconds(0);
      setLevels([]);
      // Audio arrives in small pieces as it records, so pausing can play back what is there so far.
      recorder.start(250);
      startMeter(stream);
      setVoiceState('recording');
    } catch (error) {
      // Tell the real reason: blocked permission, no microphone, or the mic is busy.
      const name = error instanceof DOMException ? error.name : '';
      const message =
        name === 'NotFoundError' || name === 'OverconstrainedError'
          ? labels.voiceNoMic
          : name === 'NotReadableError' || name === 'AbortError'
            ? labels.voiceBusy
            : name === 'NotSupportedError'
              ? labels.voiceUnsupported
              : undefined;
      onRecorderError?.(message ?? labels.voiceDenied);
      setVoiceState('idle');
    }
  };

  /** Pause: stop the mic for now and let the user listen to what is recorded. */
  const pauseRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    stopMeter();
    recorder.pause();
    try {
      recorder.requestData();
    } catch {
      // Older Safari: the pieces from start(250) are already there.
    }
    setVoiceState('paused');
    window.setTimeout(() => {
      clearPreview();
      if (chunksRef.current.length) setPreviewUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: audioType() })));
    }, 150);
  };

  const resumeRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    clearPreview();
    recorder.resume();
    startMeter(recorder.stream);
    setVoiceState('recording');
  };

  const togglePreview = () => {
    const audio = previewRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().then(() => setPreviewPlaying(true)).catch(() => setPreviewPlaying(false));
    else {
      audio.pause();
      setPreviewPlaying(false);
    }
  };

  const finishRecording = (finish: 'send' | 'discard') => {
    const recorder = recorderRef.current;
    finishRef.current = finish;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else setVoiceState('idle');
  };

  const { isDragging, dropProps } = useFileDrop({
    onFiles: (files) => {
      const input = fileInputRef.current;
      if (input && !input.disabled) dropFilesIntoInput(input, files);
    },
    accept: 'image/*,video/*,application/pdf',
    multiple: true,
    disabled: attachDisabled,
  });

  // Pasting a screenshot or copied file (Ctrl+V / Cmd+V, or Paste on iPhone and iPad) attaches it.
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (attachDisabled) return;
    const data = event.clipboardData;
    let files = Array.from(data?.files ?? []);
    // iOS Safari sometimes exposes the image only through items.
    if (files.length === 0 && data?.items) {
      files = Array.from(data.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
    }
    const accepted = files.filter((file) => fileMatchesAccept(file, CHAT_ATTACHMENT_ACCEPT));
    if (accepted.length === 0) return;
    event.preventDefault();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    // Pasted screenshots all arrive as "image.png"; give each a readable, unique name.
    const named = accepted.map((file, index) =>
      /^image\.\w+$/i.test(file.name) || !file.name
        ? new File([file], `screenshot-${stamp}${accepted.length > 1 ? `-${index + 1}` : ''}.${(file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: file.type })
        : file
    );
    const input = fileInputRef.current;
    if (input && !input.disabled) dropFilesIntoInput(input, named);
  };

  // Dropping files anywhere on the chat box attaches them like the + menu does.
  return (
    <div {...dropProps} className="relative w-full min-w-0">
    <div className="flex w-full min-w-0 flex-col gap-1">
      {isDragging ? (
        <div className="pointer-events-none m-1 flex h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-red-600 bg-red-50 text-sm font-semibold text-red-600 transition-all">
          <FileUp className="h-7 w-7" />
          {labels.dropFiles ?? 'Drop images, PDFs or videos here'}
        </div>
      ) : null}
      {attachments}
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
          accept={CHAT_ATTACHMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={onFileSelect}
        />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAttachMenuOpen((open) => !open)}
            disabled={attachDisabled}
            className="cursor-pointer rounded-lg p-2.5 text-black transition-colors hover:animate-pulse hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={labels.attachFiles}
            aria-expanded={attachMenuOpen}
          >
            <Plus className="h-5 w-5" />
          </button>
          {attachMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setAttachMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {crmActions && crmActions.length > 0 ? (
                  <>
                    {crmActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          action.onSelect();
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-red-600">{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                    <div className="my-1 border-t border-gray-100" />
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    openPicker(fileInputRef.current, 'image/*,video/*,application/pdf', false);
                    setAttachMenuOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Paperclip className="h-4 w-4 text-red-600" />
                  {labels.uploadFiles}
                </button>
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAttachMenuOpen(false)}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Cloud className="h-4 w-4 text-red-600" />
                  {labels.addFromGoogleDrive}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (window.matchMedia('(pointer: coarse) and (hover: none)').matches) openPicker(fileInputRef.current, 'image/*,video/*', true);
                    else setWebcamOpen(true);
                    setAttachMenuOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Camera className="h-4 w-4 text-red-600" />
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
                  <ImageIcon className="h-4 w-4 text-red-600" />
                  {labels.photos}
                </button>
              </div>
            </>
          )}
        </div>
        {recording ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 py-2" role="status" aria-live="polite">
            <button
              type="button"
              onClick={() => finishRecording('discard')}
              className="shrink-0 cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
              aria-label={labels.cancelVoice ?? 'Delete'}
              title={labels.cancelVoice ?? 'Delete'}
            >
              <Trash2 className="h-5 w-5" />
            </button>
            {/* Push play, timer and wave to the right */}
            <span className="flex-1" aria-hidden />
            {voiceState === 'recording' ? (
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-600" aria-hidden />
            ) : (
              <button
                type="button"
                onClick={togglePreview}
                disabled={!previewUrl}
                className="shrink-0 cursor-pointer rounded-lg p-1.5 text-gray-800 hover:bg-gray-100 disabled:opacity-40"
                aria-label={previewPlaying ? labels.pauseVoice ?? 'Pause' : labels.playVoice ?? 'Play'}
                title={previewPlaying ? labels.pauseVoice ?? 'Pause' : labels.playVoice ?? 'Play'}
              >
                {previewPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
            )}
            <span className="w-10 shrink-0 text-sm font-medium tabular-nums text-gray-800">
              <span className="sr-only">{labels.recordingVoice ?? 'Recording'} </span>
              {recordingTime(recordSeconds)}
            </span>
            {/* Sound wave right after the play button and timer; it stands still while paused */}
            <span className="flex h-8 w-1/2 min-w-0 shrink-0 items-center justify-between gap-[2px] overflow-hidden" aria-hidden>
              {Array.from({ length: WAVE_BARS }, (_, i) => {
                const level = levels[levels.length - WAVE_BARS + i];
                return (
                  <span
                    key={i}
                    className={`w-[3px] min-w-0 shrink rounded-sm transition-[height] duration-100 ${
                      level === undefined ? 'bg-gray-200' : voiceState === 'paused' ? 'bg-gray-400' : 'bg-gray-600'
                    }`}
                    style={{ height: `${Math.max(3, Math.round((level ?? 0.1) * 28))}px` }}
                  />
                );
              })}
            </span>
            {previewUrl ? (
              <audio ref={previewRef} src={previewUrl} onEnded={() => setPreviewPlaying(false)} className="hidden" preload="auto" />
            ) : null}
          </div>
        ) : null}
        <div className={`min-w-0 flex-1 ${recording ? 'hidden' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            onPaste={onPaste}
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
          onClick={() =>
            voiceState === 'recording' ? pauseRecording() : voiceState === 'paused' ? resumeRecording() : void startRecording()
          }
          disabled={attachDisabled}
          className={`mr-1 shrink-0 cursor-pointer rounded-lg p-2.5 disabled:cursor-not-allowed disabled:opacity-50 ${
            voiceState === 'paused' ? 'text-red-600' : voiceState === 'recording' ? 'bg-red-600 text-white' : 'text-black'
          }`}
          aria-label={voiceState === 'recording' ? labels.pauseVoice ?? 'Pause' : voiceState === 'paused' ? labels.resumeVoice ?? 'Resume' : labels.voiceNote}
          title={voiceState === 'recording' ? labels.pauseVoice ?? 'Pause' : voiceState === 'paused' ? labels.resumeVoice ?? 'Resume' : labels.voiceNote}
        >
          {voiceState === 'recording' ? <Pause className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          type={recording ? 'button' : 'submit'}
          onClick={recording ? () => finishRecording('send') : undefined}
          disabled={recording ? false : sendDisabled}
          className={`send-button-plane ml-1 flex shrink-0 cursor-pointer items-center justify-center overflow-visible rounded-lg bg-black p-2.5 text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 ${hasText ? 'has-text' : ''}`}
          aria-label={recording ? labels.sendVoice ?? labels.send : labels.send}
        >
          <span className="send-plane-icon inline-block text-white">
            <Send className="h-5 w-5" stroke="currentColor" />
          </span>
        </button>
      </div>
    </div>
    <WebcamCapture
      open={webcamOpen}
      onClose={() => setWebcamOpen(false)}
      onPhoto={(file) => {
        const input = fileInputRef.current;
        if (input && !input.disabled) dropFilesIntoInput(input, [file]);
      }}
    />
    </div>
  );
}
