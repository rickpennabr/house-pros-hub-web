'use client';

import { useRef, useState, type ReactNode } from 'react';
import { UploadCloud } from 'lucide-react';
import { useFileDrop } from '@/hooks/useFileDrop';

interface FileDropZoneProps {
  /** Files that passed the type and size checks. */
  onFiles: (files: File[]) => void;
  /** Same format as <input accept>, e.g. "image/*" or ".pdf,image/jpeg". */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Files over this size are refused with a message. */
  maxSizeMb?: number;
  /** Main line; defaults to "Drag files here or browse". */
  label?: ReactNode;
  /** Second line, e.g. "PDF, JPEG, PNG or WebP · up to 20 MB". */
  hint?: ReactNode;
  /** Smaller padding for tight spots (a form row, a modal). */
  compact?: boolean;
  /** Shown under the box; for errors from the parent's upload. */
  error?: string | null;
  className?: string;
  /** Shown inside the box under the text, e.g. a list of chosen files. */
  children?: ReactNode;
}

/**
 * The standard upload box: dashed border, drag and drop, click (or Enter) to browse. Use it for
 * every upload area; for a logo or avatar tile use the useFileDrop hook on the tile instead.
 */
export function FileDropZone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  maxSizeMb,
  label,
  hint,
  compact = false,
  error,
  className = '',
  children,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const take = (files: File[]) => {
    setLocalError(null);
    const tooBig = maxSizeMb ? files.filter((file) => file.size > maxSizeMb * 1024 * 1024) : [];
    const ok = files.filter((file) => !tooBig.includes(file));
    if (tooBig.length > 0) {
      setLocalError(
        tooBig.length === 1
          ? `${tooBig[0].name} is over ${maxSizeMb} MB.`
          : `${tooBig.length} files are over ${maxSizeMb} MB.`
      );
    }
    if (ok.length > 0) onFiles(ok);
  };

  const { isDragging, dropProps } = useFileDrop({
    onFiles: take,
    accept,
    multiple,
    disabled,
    onRejected: (files) =>
      setLocalError(files.length === 1 ? `${files[0].name} is not a supported file type.` : 'Some files are not a supported type.'),
  });

  const shownError = error || localError;

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        {...dropProps}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors ${
          compact ? 'gap-1 p-3' : 'gap-1.5 p-6'
        } ${
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
            : isDragging
              ? 'cursor-copy border-red-600 bg-red-50'
              : 'cursor-pointer border-gray-300 bg-white hover:border-black hover:bg-gray-50'
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-black`}
      >
        <UploadCloud className={`${compact ? 'h-5 w-5' : 'h-7 w-7'} ${isDragging ? 'text-red-600' : 'text-gray-500'}`} aria-hidden />
        <p className="text-sm text-gray-800">
          {isDragging ? (
            <span className="font-medium text-red-600">Drop to upload</span>
          ) : (
            label ?? (
              <>
                Drag {multiple ? 'files' : 'a file'} here or <span className="font-medium text-red-600 underline">browse</span>
              </>
            )
          )}
        </p>
        {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
        {children ? (
          <div className="w-full" onClick={(event) => event.stopPropagation()}>
            {children}
          </div>
        ) : null}
      </div>
      {shownError ? <p className="mt-1 text-sm text-red-600">{shownError}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) take(multiple ? files : files.slice(0, 1));
        }}
      />
    </div>
  );
}
