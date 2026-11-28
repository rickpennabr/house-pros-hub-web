'use client';

import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent, type ReactNode, type Ref } from 'react';
import { ArrowUpRight, Crop, Download, Grid3x3, Pencil, Redo2, RotateCw, Smile, Square, Type, Undo2 } from 'lucide-react';

/**
 * WhatsApp-style photo edit inside the chat send screen: crop, rotate, draw, arrow, box, text,
 * blur, emoji, color, undo/redo and download. Each step is baked into the picture, so undo
 * goes back one picture. The composer asks for the edited file before it moves on or sends.
 */
export interface ChatImageEditorHandle {
  /** The edited photo, or null when nothing was changed. */
  exportIfEdited: () => Promise<File | null>;
}

type Tool = 'none' | 'crop' | 'draw' | 'arrow' | 'rect' | 'text' | 'blur' | 'emoji';
type Point = { x: number; y: number };
interface Draft {
  kind: 'crop' | 'draw' | 'arrow' | 'rect' | 'blur';
  points: Point[];
}

const COLORS = ['#ef4444', '#f5d90a', '#ffffff', '#111111', '#2563eb', '#16a34a'];
const EMOJIS = ['😀', '😂', '😍', '😮', '😢', '👍', '👎', '🙏', '👏', '🔥', '❤️', '✅', '❌', '⚠️', '👉', '🏠', '🔧', '💧', '⚡', '⭐'];
/** Big phone photos are scaled down so each undo step stays light. */
const MAX_SIDE = 2400;
const HISTORY = 12;

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext('2d')?.drawImage(source, 0, 0);
  return copy;
}

function box(points: Point[]) {
  const a = points[0];
  const b = points[points.length - 1];
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

function EditButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-30 ${active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );
}

function editedName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '') || 'photo';
  return `${stem}-edited.jpg`;
}

export function ChatImageEditor({
  url,
  name,
  file,
  ref,
}: {
  url: string;
  name: string;
  /** The original picked file, when the browser still has it (no download needed). */
  file?: File;
  ref?: Ref<ChatImageEditorHandle>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const undoRef = useRef<HTMLCanvasElement[]>([]);
  const redoRef = useRef<HTMLCanvasElement[]>([]);
  const draftRef = useRef<Draft | null>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [color, setColor] = useState(COLORS[0]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [textAt, setTextAt] = useState<Point | null>(null);
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const bump = () => setHistory({ undo: undoRef.current.length, redo: redoRef.current.length });

  const lineWidth = () => Math.max(4, (baseRef.current?.width ?? 1000) / 200);

  const fit = () => {
    const frame = frameRef.current;
    const view = viewRef.current;
    const base = baseRef.current;
    if (!frame || !view || !base) return;
    const scale = Math.min(frame.clientWidth / base.width, frame.clientHeight / base.height);
    view.style.width = `${Math.max(1, base.width * scale)}px`;
    view.style.height = `${Math.max(1, base.height * scale)}px`;
    if (view.width !== base.width || view.height !== base.height) {
      view.width = base.width;
      view.height = base.height;
    }
    paint();
  };

  const strokeShape = (context: CanvasRenderingContext2D, draft: Draft) => {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lineWidth();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (draft.kind === 'draw') {
      context.beginPath();
      context.moveTo(draft.points[0].x, draft.points[0].y);
      draft.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
      return;
    }
    if (draft.kind === 'rect') {
      const r = box(draft.points);
      context.strokeRect(r.x, r.y, r.w, r.h);
      return;
    }
    if (draft.kind === 'arrow') {
      const start = draft.points[0];
      const end = draft.points[draft.points.length - 1];
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const head = context.lineWidth * 4;
      context.beginPath();
      context.moveTo(end.x, end.y);
      context.lineTo(end.x - head * Math.cos(angle - 0.4), end.y - head * Math.sin(angle - 0.4));
      context.lineTo(end.x - head * Math.cos(angle + 0.4), end.y - head * Math.sin(angle + 0.4));
      context.closePath();
      context.fill();
    }
  };

  const paint = () => {
    const view = viewRef.current;
    const base = baseRef.current;
    const context = view?.getContext('2d');
    if (!view || !base || !context) return;
    context.clearRect(0, 0, view.width, view.height);
    context.drawImage(base, 0, 0);
    const draft = draftRef.current;
    if (!draft || draft.points.length < 2) return;
    if (draft.kind === 'crop' || draft.kind === 'blur') {
      const r = box(draft.points);
      context.save();
      if (draft.kind === 'crop') {
        // Dim what will be cut away.
        context.fillStyle = 'rgba(0,0,0,0.5)';
        context.fillRect(0, 0, view.width, r.y);
        context.fillRect(0, r.y + r.h, view.width, view.height - r.y - r.h);
        context.fillRect(0, r.y, r.x, r.h);
        context.fillRect(r.x + r.w, r.y, view.width - r.x - r.w, r.h);
      }
      context.setLineDash([lineWidth() * 2, lineWidth() * 2]);
      context.strokeStyle = '#ffffff';
      context.lineWidth = Math.max(2, lineWidth() / 2);
      context.strokeRect(r.x, r.y, r.w, r.h);
      context.restore();
      return;
    }
    strokeShape(context, draft);
  };

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const base = document.createElement('canvas');
      base.width = Math.max(1, Math.round(image.naturalWidth * scale));
      base.height = Math.max(1, Math.round(image.naturalHeight * scale));
      base.getContext('2d')?.drawImage(image, 0, 0, base.width, base.height);
      baseRef.current = base;
      undoRef.current = [];
      redoRef.current = [];
      setReady(true);
      fit();
    };
    image.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    const load = file
      ? Promise.resolve<Blob>(file)
      : fetch(url).then((response) => {
          if (!response.ok) throw new Error('fetch failed');
          return response.blob();
        });
    load
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        image.src = objectUrl;
      })
      .catch(() => {
        if (cancelled) return;
        image.crossOrigin = 'anonymous';
        image.src = url;
      });
    const frame = frameRef.current;
    const observer = frame ? new ResizeObserver(() => fit()) : null;
    if (frame) observer?.observe(frame);
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // fit and paint read refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, file]);

  /** Save one step: the picture before it goes on the undo stack. */
  const commit = (change: (base: HTMLCanvasElement) => HTMLCanvasElement | void) => {
    const base = baseRef.current;
    if (!base) return;
    undoRef.current = [...undoRef.current, copyCanvas(base)].slice(-HISTORY);
    redoRef.current = [];
    const next = change(base);
    if (next) baseRef.current = next;
    bump();
    fit();
  };

  const finishDraft = (draft: Draft) => {
    const r = box(draft.points);
    if (draft.kind === 'crop') {
      if (r.w < 20 || r.h < 20) return;
      commit((base) => {
        const next = document.createElement('canvas');
        next.width = Math.round(r.w);
        next.height = Math.round(r.h);
        next.getContext('2d')?.drawImage(base, r.x, r.y, r.w, r.h, 0, 0, next.width, next.height);
        return next;
      });
      setTool('none');
      return;
    }
    if (draft.kind === 'blur') {
      if (r.w < 4 || r.h < 4) return;
      commit((base) => {
        const context = base.getContext('2d');
        if (!context) return;
        const block = Math.max(8, base.width / 60);
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(r.w / block));
        small.height = Math.max(1, Math.round(r.h / block));
        small.getContext('2d')?.drawImage(base, r.x, r.y, r.w, r.h, 0, 0, small.width, small.height);
        context.save();
        context.imageSmoothingEnabled = false;
        context.drawImage(small, 0, 0, small.width, small.height, r.x, r.y, r.w, r.h);
        context.restore();
      });
      return;
    }
    commit((base) => {
      const context = base.getContext('2d');
      if (context) strokeShape(context, draft);
    });
  };

  const putText = (value: string, at: Point, size: number, outlined: boolean) => {
    commit((base) => {
      const context = base.getContext('2d');
      if (!context) return;
      context.save();
      context.font = `bold ${size}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      if (outlined) {
        context.lineWidth = Math.max(2, size / 10);
        context.strokeStyle = color === '#111111' ? '#ffffff' : '#111111';
        context.lineJoin = 'round';
        context.strokeText(value, at.x, at.y);
        context.fillStyle = color;
      }
      context.fillText(value, at.x, at.y);
      context.restore();
    });
  };

  const commitText = () => {
    if (textAt && text.trim()) putText(text.trim(), textAt, Math.max(24, (baseRef.current?.width ?? 1000) / 16), true);
    setText('');
    setTextAt(null);
  };

  const rotate = () => {
    commit((base) => {
      const next = document.createElement('canvas');
      next.width = base.height;
      next.height = base.width;
      const context = next.getContext('2d');
      if (!context) return;
      context.translate(next.width, 0);
      context.rotate(Math.PI / 2);
      context.drawImage(base, 0, 0);
      return next;
    });
  };

  const undo = () => {
    const previous = undoRef.current.pop();
    if (!previous || !baseRef.current) return;
    redoRef.current = [...redoRef.current, baseRef.current];
    baseRef.current = previous;
    bump();
    fit();
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next || !baseRef.current) return;
    undoRef.current = [...undoRef.current, baseRef.current];
    baseRef.current = next;
    bump();
    fit();
  };

  const toBlob = () =>
    new Promise<Blob | null>((resolve, reject) => {
      try {
        baseRef.current?.toBlob(resolve, 'image/jpeg', 0.9);
      } catch {
        // A photo from another site without permission cannot be read back.
        reject(new Error('This photo cannot be edited here. Remove it and add it again.'));
      }
    });

  useImperativeHandle(ref, () => ({
    exportIfEdited: async () => {
      commitText();
      if (undoRef.current.length === 0 || !baseRef.current) return null;
      const blob = await toBlob();
      if (!blob) return null;
      return new File([blob], editedName(name), { type: 'image/jpeg' });
    },
  }));

  const download = async () => {
    const blob = await toBlob().catch(() => null);
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = undoRef.current.length > 0 ? editedName(name) : name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  };

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const view = viewRef.current;
    if (!view) return { x: 0, y: 0 };
    const rect = view.getBoundingClientRect();
    return {
      x: Math.min(view.width, Math.max(0, ((event.clientX - rect.left) / rect.width) * view.width)),
      y: Math.min(view.height, Math.max(0, ((event.clientY - rect.top) / rect.height) * view.height)),
    };
  };

  const pick = (next: Tool) => {
    commitText();
    setEmojiOpen(false);
    setTool((current) => (current === next ? 'none' : next));
  };

  const showsColor = tool === 'draw' || tool === 'arrow' || tool === 'rect' || tool === 'text';
  const toolProps = (id: Tool, label: string) => ({ label, active: tool === id, disabled: !ready, onClick: () => pick(id) });

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="relative flex shrink-0 items-center gap-1 overflow-x-auto px-2 pb-2">
        <EditButton label="Undo" disabled={!ready || history.undo === 0} onClick={undo}><Undo2 className="h-5 w-5" /></EditButton>
        <EditButton label="Redo" disabled={!ready || history.redo === 0} onClick={redo}><Redo2 className="h-5 w-5" /></EditButton>
        <span className="mx-1 h-6 w-px shrink-0 bg-gray-200" aria-hidden />
        <EditButton {...toolProps('crop', 'Crop')}><Crop className="h-5 w-5" /></EditButton>
        <EditButton label="Rotate" disabled={!ready} onClick={rotate}><RotateCw className="h-5 w-5" /></EditButton>
        <EditButton {...toolProps('draw', 'Draw')}><Pencil className="h-5 w-5" /></EditButton>
        <EditButton {...toolProps('arrow', 'Arrow')}><ArrowUpRight className="h-5 w-5" /></EditButton>
        <EditButton {...toolProps('rect', 'Box')}><Square className="h-5 w-5" /></EditButton>
        <EditButton {...toolProps('text', 'Text')}><Type className="h-5 w-5" /></EditButton>
        <EditButton {...toolProps('blur', 'Blur')}><Grid3x3 className="h-5 w-5" /></EditButton>
        <EditButton
          label="Emoji"
          active={tool === 'emoji'}
          disabled={!ready}
          onClick={() => {
            commitText();
            setEmojiOpen((value) => !value);
          }}
        >
          <Smile className="h-5 w-5" />
        </EditButton>
        {showsColor ? (
          <button
            type="button"
            onClick={() => setColor(COLORS[(COLORS.indexOf(color) + 1) % COLORS.length])}
            aria-label="Color"
            title="Color"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <span className="h-5 w-5 rounded-md border-2 border-gray-300" style={{ backgroundColor: color }} />
          </button>
        ) : null}
        <span className="mx-1 h-6 w-px shrink-0 bg-gray-200" aria-hidden />
        <EditButton label="Download" disabled={!ready} onClick={() => void download()}><Download className="h-5 w-5" /></EditButton>
      </div>
      {emojiOpen ? (
        <div className="mx-2 mb-2 grid shrink-0 grid-cols-10 gap-1 rounded-lg border-2 border-gray-200 bg-white p-2">
          {EMOJIS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setEmoji(item);
                setTool('emoji');
                setEmojiOpen(false);
              }}
              className={`flex h-8 items-center justify-center rounded-md text-xl hover:bg-gray-100 ${tool === 'emoji' && emoji === item ? 'bg-gray-200' : ''}`}
              aria-label={item}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={frameRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {failed ? <p className="text-sm text-gray-500">This photo could not be opened.</p> : null}
        <canvas
          ref={viewRef}
          className={`touch-none shadow-lg ${ready ? '' : 'invisible'} ${tool === 'none' ? '' : 'cursor-crosshair'}`}
          onPointerDown={(event) => {
            if (!ready || tool === 'none') return;
            event.preventDefault();
            const point = pointFrom(event);
            if (tool === 'text') {
              commitText();
              setTextAt(point);
              return;
            }
            if (tool === 'emoji') {
              putText(emoji, point, Math.max(48, (baseRef.current?.width ?? 1000) / 7), false);
              return;
            }
            draftRef.current = { kind: tool, points: [point] };
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // iOS can refuse capture. The move events still follow the finger.
            }
          }}
          onPointerMove={(event) => {
            const draft = draftRef.current;
            if (!draft) return;
            const point = pointFrom(event);
            draftRef.current = draft.kind === 'draw' ? { ...draft, points: [...draft.points, point] } : { ...draft, points: [draft.points[0], point] };
            paint();
          }}
          onPointerUp={() => {
            const draft = draftRef.current;
            draftRef.current = null;
            if (draft && draft.points.length >= 2) finishDraft(draft);
            else paint();
          }}
        />
        {textAt ? (
          <input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commitText}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                commitText();
              }
              if (event.key === 'Escape') {
                event.stopPropagation();
                setText('');
                setTextAt(null);
              }
            }}
            placeholder="Type, then Enter"
            maxLength={80}
            className="absolute left-1/2 top-3 w-[min(90%,24rem)] -translate-x-1/2 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm text-black"
          />
        ) : null}
      </div>
    </div>
  );
}
