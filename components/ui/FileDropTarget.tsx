'use client';

import { useRef, type ReactNode, type RefObject } from 'react';
import { dropFilesIntoInput, useFileDrop } from '@/hooks/useFileDrop';

interface FileDropTargetProps {
  /**
   * Receives the dropped files. Without it (and without inputRef) the file input inside the
   * target gets them, e.g. a <label> that wraps its <input type="file">.
   */
  onFiles?: (files: File[]) => void;
  /**
   * The tile's hidden file input: dropped files go into it and its onChange runs, so existing
   * pick-a-file code handles drops too. Its accept and multiple apply unless set here.
   */
  inputRef?: RefObject<HTMLInputElement | null>;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onRejected?: (files: File[]) => void;
  /** Rounding of the drop highlight; match the tile inside (e.g. "rounded-md" for a small tile). */
  rounded?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Adds drag and drop to an upload tile that already opens a file picker on click (a logo, an
 * avatar, a photo square). The tile keeps its look; while a file is dragged over it a red
 * outline and "Drop" show. For a plain upload box use FileDropZone.
 */
export function FileDropTarget({
  onFiles,
  inputRef,
  accept,
  multiple,
  disabled = false,
  onRejected,
  rounded = 'rounded-lg',
  className = '',
  children,
}: FileDropTargetProps) {
  const container = useRef<HTMLDivElement>(null);
  const input = () =>
    inputRef?.current ?? container.current?.querySelector<HTMLInputElement>('input[type="file"]') ?? null;
  const { isDragging, dropProps } = useFileDrop({
    onFiles: (files) => {
      if (onFiles) return onFiles(files);
      const target = input();
      if (target && !target.disabled) dropFilesIntoInput(target, files);
    },
    accept: () => accept ?? (input()?.accept || undefined),
    multiple: () => multiple ?? input()?.multiple ?? false,
    disabled,
    onRejected,
  });
  return (
    <div ref={container} {...dropProps} className={`${/(absolute|fixed)/.test(className) ? '' : 'relative '}${className}`}>
      {children}
      {isDragging ? (
        <div
          className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-red-600 bg-red-50/80 text-xs font-semibold text-red-600 ${rounded}`}
        >
          Drop
        </div>
      ) : null}
    </div>
  );
}
