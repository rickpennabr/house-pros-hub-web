'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, FileText, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ProDriveUploadItem {
  id: string;
  name: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

interface ProDriveUploadStatusProps {
  items: ProDriveUploadItem[];
  onDismiss: () => void;
}

export function ProDriveUploadStatus({ items, onDismiss }: ProDriveUploadStatusProps) {
  const t = useTranslations('prodrive');
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const uploading = items.filter((item) => item.status === 'uploading').length;
  const done = items.filter((item) => item.status === 'done').length;
  const failed = items.filter((item) => item.status === 'error').length;
  const title = uploading > 0
    ? t('uploadingCount', { count: uploading })
    : failed > 0 && done > 0
      ? t('uploadMixed', { done, failed })
      : failed > 0
        ? t('uploadFailedCount', { count: failed })
        : t('uploadCompleteCount', { count: done });

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border-2 border-black bg-white">
      <div className="flex items-center justify-between gap-2 border-b-2 border-black px-3 py-2">
        <p className="min-w-0 truncate text-sm font-medium text-black">{title}</p>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((open) => !open)}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100"
            aria-label={t('cancel')}
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {!collapsed && (
        <ul className="max-h-64 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 border-b border-black/10 px-3 py-2 last:border-b-0">
              <FileText className="h-4 w-4 shrink-0 text-red-600" />
              <span className="min-w-0 flex-1 truncate text-sm text-black" title={item.error || item.name}>
                {item.name}
              </span>
              {item.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-black" />}
              {item.status === 'done' && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
              {item.status === 'error' && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white" title={item.error}>
                  <X className="h-3 w-3" />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
