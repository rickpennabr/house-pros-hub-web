'use client';

import { useState, useEffect, useRef } from 'react';
import { Pencil, ImagePlus, Move, Check } from 'lucide-react';

function normalizePosition(pos: string | undefined): string {
  return (pos ?? '').trim() || '50% 50%';
}

export interface BackgroundImageEditProps {
  /** Current background position (e.g. from drag). */
  position?: string;
  /** Position at last "save" or when adjust started; when different from position, show Save button. */
  savedPosition?: string;
  /** Called when user clicks the green Save button; parent should persist and update savedPosition. */
  onSave?: () => void;
  onPositionChange?: (position: string) => void;
  onUploadClick: () => void;
  /** Called when user chooses "Adjust image"; parent can show a hint and set savedPosition to current. */
  onAdjustClick?: () => void;
  disabled?: boolean;
  className?: string;
  inline?: boolean;
  /** When not inline: position of the edit button on the hero image. Default top-right for view page. */
  anchor?: 'top-left' | 'top-right';
  modalTitle?: string;
  adjustImageLabel?: string;
  uploadNewLabel?: string;
}

/** Edit dropdown for background image: "Adjust image" (drag to position) and "Upload new". When position differs from saved, shows green Save button. */
export function BackgroundImageEdit({
  position,
  savedPosition,
  onSave,
  onUploadClick,
  onAdjustClick,
  disabled = false,
  className = '',
  inline = false,
  anchor = 'top-right',
  adjustImageLabel = 'Adjust image',
  uploadNewLabel = 'Upload new',
}: BackgroundImageEditProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current = normalizePosition(position);
  const saved = normalizePosition(savedPosition);
  const hasUnsavedPosition = onSave != null && current !== saved;

  const handleAdjustClick = () => {
    setMenuOpen(false);
    onAdjustClick?.();
  };

  const handleUploadNew = () => {
    setMenuOpen(false);
    onUploadClick();
  };

  const handleSaveClick = () => {
    setMenuOpen(false);
    onSave?.();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const anchorClass = inline ? '' : anchor === 'top-right' ? 'absolute top-2 right-2' : 'absolute top-2 left-2';
  const dropdownAlignClass = anchor === 'top-right' ? 'right-0' : 'left-0';

  return (
    <div
      ref={wrapperRef}
      className={`relative z-30 ${anchorClass}`}
    >
      {hasUnsavedPosition ? (
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={disabled}
          className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-white bg-green-600 text-white shadow hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none ${className}`}
          aria-label="Save new image position"
        >
          <Check className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          disabled={disabled}
          className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-white text-black shadow hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none ${className}`}
          aria-label="Edit background image"
          aria-expanded={menuOpen}
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}

      {menuOpen && (
        <div className={`absolute ${dropdownAlignClass} top-full mt-1 min-w-[160px] rounded-lg border-2 border-black bg-white py-1 shadow-lg`}>
          <div className="py-0.5">
            <button
              type="button"
              onClick={handleAdjustClick}
              className="flex w-full cursor-pointer items-center gap-2 rounded-none px-3 py-2 text-left text-sm font-medium text-black hover:bg-gray-50"
            >
              <Move className="w-4 h-4 shrink-0" />
              {adjustImageLabel}
            </button>
            <button
              type="button"
              onClick={handleUploadNew}
              className="flex w-full cursor-pointer items-center gap-2 rounded-none px-3 py-2 text-left text-sm font-medium text-black hover:bg-gray-50"
            >
              <ImagePlus className="w-4 h-4 shrink-0" />
              {uploadNewLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
