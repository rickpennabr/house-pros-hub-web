'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Pencil, RotateCcw, Type, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Mark {
  kind: 'draw' | 'arrow' | 'text';
  color: string;
  points: { x: number; y: number }[];
  text?: string;
}

interface JobPhotoMarkupProps {
  url: string;
  saving: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
}

const COLORS = ['#f5d90a', '#ef4444', '#ffffff', '#2563eb', '#16a34a', '#111111'];

/**
 * Draw on the photo. Save replaces the job image with the marked copy.
 */
export function JobPhotoMarkup({ url, saving, onClose, onSave }: JobPhotoMarkupProps) {
  const t = useTranslations('jobsite');
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const marksRef = useRef<Mark[]>([]);
  const draftRef = useRef<Mark | null>(null);
  const [tool, setTool] = useState<'draw' | 'arrow' | 'text'>('draw');
  const [color, setColor] = useState(COLORS[0]);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState('');
  const [ready, setReady] = useState(false);

  const placeCanvas = () => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!frame || !canvas || !image || image.width === 0) return;
    const scale = Math.min(frame.clientWidth / image.width, frame.clientHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    canvas.style.left = `${(frame.clientWidth - width) / 2}px`;
    canvas.style.top = `${(frame.clientHeight - height) / 2}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = image.width;
    canvas.height = image.height;
    paint();
  };

  const paint = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const mark of [...marksRef.current, draftRef.current].filter((mark): mark is Mark => Boolean(mark))) {
      context.strokeStyle = mark.color;
      context.fillStyle = mark.color;
      context.lineWidth = Math.max(6, canvas.width / 180);
      context.lineCap = 'round';
      if (mark.kind === 'text' && mark.text) {
        context.font = 'bold 48px sans-serif';
        context.fillText(mark.text, mark.points[0]?.x ?? 0, mark.points[0]?.y ?? 0);
        continue;
      }
      if (mark.points.length < 2) continue;
      if (mark.kind === 'arrow') {
        const start = mark.points[0];
        const end = mark.points[mark.points.length - 1];
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
        continue;
      }
      context.beginPath();
      context.moveTo(mark.points[0].x, mark.points[0].y);
      mark.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    }
  };

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    void fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        if (cancelled) return;
        image.src = URL.createObjectURL(blob);
      })
      .catch(() => {
        if (!cancelled) image.src = url;
      });
    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;
      setReady(true);
      placeCanvas();
    };
    const frame = frameRef.current;
    const observer = frame ? new ResizeObserver(() => placeCanvas()) : null;
    if (frame) observer?.observe(frame);
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [url]);

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const commitText = () => {
    if (textAt && text.trim()) {
      marksRef.current = [...marksRef.current, { kind: 'text', color, points: [textAt], text: text.trim() }];
      paint();
    }
    setText('');
    setTextAt(null);
  };

  const save = async () => {
    commitText();
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const output = document.createElement('canvas');
    output.width = image.width;
    output.height = image.height;
    const context = output.getContext('2d');
    if (!context) return;
    context.drawImage(image, 0, 0, image.width, image.height);
    context.drawImage(canvas, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;
    await onSave(new File([blob], `job-edit-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[450] flex h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <div className="flex shrink-0 items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15" aria-label={t('closePhoto')}>
          <X className="h-5 w-5" />
        </button>
        <button type="button" disabled={!ready || saving} onClick={() => void save()} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
          {saving ? t('saving') : t('saveImage')}
        </button>
      </div>
      <div ref={frameRef} className="relative min-h-0 flex-1 overflow-hidden">
        {ready ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageRef.current?.src} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
        ) : null}
        <canvas
          ref={canvasRef}
          className="absolute touch-none"
          onPointerDown={(event) => {
            event.preventDefault();
            if (tool === 'text') {
              commitText();
              setTextAt(pointFrom(event));
              return;
            }
            draftRef.current = { kind: tool, color, points: [pointFrom(event)] };
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // iOS can reject capture. The move events still follow the finger.
            }
          }}
          onPointerMove={(event) => {
            if (!draftRef.current) return;
            const point = pointFrom(event);
            draftRef.current = draftRef.current.kind === 'arrow'
              ? { ...draftRef.current, points: [draftRef.current.points[0], point] }
              : { ...draftRef.current, points: [...draftRef.current.points, point] };
            paint();
          }}
          onPointerUp={() => {
            if (!draftRef.current || draftRef.current.points.length < 2) {
              draftRef.current = null;
              return;
            }
            marksRef.current = [...marksRef.current, draftRef.current];
            draftRef.current = null;
            paint();
          }}
        />
        {textAt ? (
          <input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={commitText}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitText();
            }}
            placeholder={t('textMark')}
            className="absolute left-4 right-4 top-4 rounded-lg border-2 border-black px-3 py-2 text-sm text-black"
          />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" aria-label={t('textMark')} onClick={() => setTool('text')} className={`flex h-11 w-11 items-center justify-center rounded-full ${tool === 'text' ? 'bg-white text-black' : 'bg-white/15'}`}><Type className="h-5 w-5" /></button>
        <button type="button" aria-label={t('arrowMark')} onClick={() => setTool('arrow')} className={`flex h-11 w-11 items-center justify-center rounded-full ${tool === 'arrow' ? 'bg-white text-black' : 'bg-white/15'}`}><ArrowUpRight className="h-5 w-5" /></button>
        <button type="button" aria-label={t('draw')} onClick={() => setTool('draw')} className={`flex h-11 w-11 items-center justify-center rounded-full ${tool === 'draw' ? 'bg-white text-black' : 'bg-white/15'}`}><Pencil className="h-5 w-5" /></button>
        <button type="button" aria-label={t('color')} onClick={() => setColor(COLORS[(COLORS.indexOf(color) + 1) % COLORS.length])} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
          <span className="h-5 w-5 rounded-full border border-white" style={{ backgroundColor: color }} />
        </button>
        <button type="button" aria-label={t('undo')} onClick={() => { marksRef.current = marksRef.current.slice(0, -1); paint(); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"><RotateCcw className="h-5 w-5" /></button>
      </div>
    </div>,
    document.body,
  );
}
