'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';

/** Set on a drop's native event once a target took it, so targets around it skip it. */
const HANDLED = '__fileDropHandled';

/**
 * Whether a file matches an <input accept> list: ".pdf", "image/*", "image/png". Empty accepts all.
 * Exported so drop targets filter the same way the file picker does.
 */
export function fileMatchesAccept(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith('.')) return name.endsWith(rule);
      if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
}

interface UseFileDropOptions {
  /** Called with the dropped files that match `accept` (only the first unless `multiple`). */
  onFiles: (files: File[]) => void;
  /** A string, or a function read at drop time (e.g. from an input's accept). */
  accept?: string | (() => string | undefined);
  multiple?: boolean | (() => boolean);
  disabled?: boolean;
  /** Dropped files that do not match `accept`. */
  onRejected?: (files: File[]) => void;
}

/**
 * Put dropped files into an existing <input type="file"> and fire its change event, so the
 * input's own onChange handler (validation, resize, upload) runs as if the files were picked.
 */
export function dropFilesIntoInput(input: HTMLInputElement, files: File[]): void {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Drag and drop for any upload target (a dashed box, a logo tile, an avatar). Spread `dropProps`
 * on the element and style it with `isDragging`. The standard box is components/ui/FileDropZone.
 */
export function useFileDrop({ onFiles, accept, multiple = false, disabled = false, onRejected }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  // dragenter/dragleave fire for every child; count them so the highlight does not flicker.
  const depth = useRef(0);

  // A drop anywhere (or a cancelled drag) ends every highlight, including targets around the one
  // that took the files.
  useEffect(() => {
    const reset = () => {
      depth.current = 0;
      setIsDragging(false);
    };
    window.addEventListener('drop', reset);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('drop', reset);
      window.removeEventListener('dragend', reset);
    };
  }, []);

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

  const onDragEnter = useCallback(
    (event: DragEvent) => {
      if (disabled || !hasFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setIsDragging(true);
    },
    [disabled]
  );

  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (disabled || !hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [disabled]
  );

  const onDragLeave = useCallback(
    (event: DragEvent) => {
      if (disabled || !hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setIsDragging(false);
    },
    [disabled]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setIsDragging(false);
      const native = event.nativeEvent as unknown as Record<string, unknown>;
      if (disabled || native[HANDLED]) return;
      native[HANDLED] = true;
      const dropped = Array.from(event.dataTransfer.files ?? []);
      const acceptList = typeof accept === 'function' ? accept() : accept;
      const many = typeof multiple === 'function' ? multiple() : multiple;
      const accepted = dropped.filter((file) => fileMatchesAccept(file, acceptList));
      const rejected = dropped.filter((file) => !accepted.includes(file));
      if (rejected.length > 0) onRejected?.(rejected);
      const files = many ? accepted : accepted.slice(0, 1);
      if (files.length > 0) onFiles(files);
    },
    [accept, disabled, multiple, onFiles, onRejected]
  );

  return { isDragging, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
