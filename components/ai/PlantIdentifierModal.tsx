'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Camera, Leaf, Loader2, RotateCcw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FileDropZone } from '@/components/ui/FileDropZone';
import type { PlantIdentification } from '@/lib/ai/plant-id';

interface PlantIdentifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** A photo to identify right away (ProCam passes the photo being viewed). */
  initialFile?: File | null;
  /** Shown as the main action under a result, e.g. "Add to plants". */
  onUse?: (result: PlantIdentification, file: File) => void;
  useLabel?: string;
  /** Raise above full-screen views such as the ProCam photo viewer. */
  overlayClassName?: string;
}

const CONFIDENCE_CLASS: Record<PlantIdentification['confidence'], string> = {
  high: 'border-green-700 bg-green-50 text-green-800',
  medium: 'border-amber-600 bg-amber-50 text-amber-800',
  low: 'border-gray-400 bg-gray-50 text-gray-700',
};

/** "What plant is this?": take or drop a photo and get the plant's name and care. */
export function PlantIdentifierModal({
  isOpen,
  onClose,
  initialFile = null,
  onUse,
  useLabel,
  overlayClassName,
}: PlantIdentifierModalProps) {
  const t = useTranslations('plantId');
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PlantIdentification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  const identify = async (photo: File) => {
    const id = ++request.current;
    setFile(photo);
    setResult(null);
    setError(null);
    setBusy(true);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(photo);
    });
    try {
      const form = new FormData();
      form.append('file', photo);
      form.append('locale', locale);
      const res = await fetch('/api/ai/identify-plant', { method: 'POST', credentials: 'include', body: form });
      const data = await res.json().catch(() => ({}));
      if (id !== request.current) return;
      if (!res.ok) throw new Error(data.error || t('failed'));
      setResult(data.result as PlantIdentification);
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : t('failed'));
    } finally {
      if (id === request.current) setBusy(false);
    }
  };

  // A photo handed in (ProCam) is identified as soon as the window opens.
  useEffect(() => {
    if (!isOpen || !initialFile) return;
    const timer = window.setTimeout(() => void identify(initialFile), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per photo handed in
  }, [isOpen, initialFile]);

  const close = () => {
    request.current += 1;
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(false);
    onClose();
  };

  const careRows = result
    ? ([
        ['sun', result.care.sun],
        ['water', result.care.water],
        ['pruning', result.care.pruning],
        ['notes', result.care.notes],
      ] as const).filter(([, value]) => value)
    : [];

  return (
    <Modal isOpen={isOpen} onClose={close} title={t('title')} showHeader showCloseButton maxWidth="lg" overlayClassName={overlayClassName}>
      <div className="space-y-4">
        {!file ? (
          <>
            <p className="text-sm text-gray-600">{t('intro')}</p>
            <FileDropZone
              className="hidden md:block"
              accept="image/jpeg,image/png,image/webp"
              maxSizeMb={8}
              onFiles={(files) => void identify(files[0])}
              hint={t('hint')}
            />
            <div className="grid grid-cols-2 gap-2 md:hidden">
              <Button type="button" onClick={() => cameraInput.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                {t('takePhoto')}
              </Button>
              <FileDropZone compact accept="image/jpeg,image/png,image/webp" maxSizeMb={8} onFiles={(files) => void identify(files[0])} label={t('choosePhoto')} />
            </div>
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const photo = event.target.files?.[0];
                event.target.value = '';
                if (photo) void identify(photo);
              }}
            />
          </>
        ) : (
          <div className="flex gap-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview
              <img src={preview} alt="" className="h-24 w-24 shrink-0 rounded-lg border-2 border-black object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              {busy ? (
                <p className="flex items-center gap-2 text-sm text-gray-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('looking')}
                </p>
              ) : result && !result.isPlant ? (
                <p className="text-sm text-gray-700">{t('noPlant')}</p>
              ) : result ? (
                <div className="space-y-1">
                  <p className="text-lg font-bold leading-tight">{result.commonName || result.scientificName}</p>
                  {result.scientificName && result.commonName ? (
                    <p className="text-sm italic text-gray-700">{result.scientificName}</p>
                  ) : null}
                  {result.otherNames.length > 0 ? (
                    <p className="text-xs text-gray-500">{t('alsoCalled', { names: result.otherNames.join(', ') })}</p>
                  ) : null}
                  <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${CONFIDENCE_CLASS[result.confidence]}`}>
                    {t(`confidence_${result.confidence}`)}
                  </span>
                </div>
              ) : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          </div>
        )}

        {result?.isPlant ? (
          <div className="space-y-3">
            {result.summary ? <p className="text-sm text-gray-800">{result.summary}</p> : null}
            {careRows.length > 0 ? (
              <dl className="grid grid-cols-1 gap-2 rounded-lg border-2 border-black p-3 text-sm sm:grid-cols-2">
                {careRows.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs font-semibold uppercase text-gray-500">{t(`care_${key}`)}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {result.alternatives.length > 0 ? (
              <div className="text-sm">
                <p className="text-xs font-semibold uppercase text-gray-500">{t('lookAlikes')}</p>
                <ul className="mt-1 space-y-0.5">
                  {result.alternatives.map((alt) => (
                    <li key={`${alt.commonName}-${alt.scientificName}`}>
                      {alt.commonName}
                      {alt.scientificName ? <span className="italic text-gray-600"> · {alt.scientificName}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-gray-500">{t('disclaimer')}</p>
          </div>
        ) : null}

        {file && !busy ? (
          <div className="flex flex-wrap gap-2">
            {result?.isPlant && onUse ? (
              <Button type="button" onClick={() => onUse(result, file)}>
                <Leaf className="mr-2 h-4 w-4" />
                {useLabel ?? t('use')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                request.current += 1;
                setFile(null);
                setResult(null);
                setError(null);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('another')}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
