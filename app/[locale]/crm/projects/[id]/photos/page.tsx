'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { JobCameraSession } from '@/components/media/JobCameraSession';
import { ProDriveQuotaModal } from '@/components/drive/ProDriveQuotaModal';
import { Button } from '@/components/ui/Button';
import { uploadProDriveFile, ProDriveQuotaClientError } from '@/lib/drive/upload-client';
import type { DriveUsage } from '@/lib/drive/types';
import { requestCurrentLocation } from '@/lib/media/capture-location';
import { jobLocationAllowed, setJobCameraAllowed } from '@/lib/media/job-camera-prefs';

interface JobPhoto {
  id: string;
  caption: string | null;
  takenAt: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  mimeType?: string;
  url: string | null;
}

export default function JobsitePhotosPage() {
  const t = useTranslations('jobsite');
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [projectName, setProjectName] = useState('');
  const [displayId, setDisplayId] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quota, setQuota] = useState<DriveUsage | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/crm/projects/${projectId}/photos`, { credentials: 'include' });
    const body = (await response.json()) as {
      error?: string;
      project?: { name: string; displayId: string };
      businessId?: string | null;
      photos?: JobPhoto[];
    };
    if (!response.ok) {
      setError(body.error || t('loadFailed'));
      return;
    }
    setProjectName(body.project?.name ?? '');
    setDisplayId(body.project?.displayId ?? '');
    setBusinessId(body.businessId ?? null);
    setPhotos(body.photos ?? []);
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCaptured = async (items: { file: File; caption: string }[]) => {
    if (!businessId || !displayId) throw new Error(t('noBusiness'));
    setJobCameraAllowed(true);
    const shot = jobLocationAllowed() ? await requestCurrentLocation() : null;
    try {
      for (const item of items) {
        const saved = await uploadProDriveFile({
          file: item.file,
          ownerType: 'business',
          ownerId: businessId,
          ensureFolderNames: ['Jobsites', displayId],
        });
        const response = await fetch(`/api/crm/projects/${projectId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            driveFileId: saved.id,
            caption: item.caption,
            takenAt: new Date().toISOString(),
            latitude: shot?.latitude ?? null,
            longitude: shot?.longitude ?? null,
            accuracyM: shot?.accuracyM ?? null,
          }),
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error || t('saveFailed'));
        }
      }
    } catch (uploadError) {
      if (uploadError instanceof ProDriveQuotaClientError) {
        setQuota(uploadError.usage);
        throw new Error(t('saveFailed'));
      }
      throw uploadError;
    }
  };

  const groups = new Map<string, JobPhoto[]>();
  for (const photo of photos) {
    const day = new Date(photo.takenAt).toLocaleDateString();
    const list = groups.get(day) ?? [];
    list.push(photo);
    groups.set(day, list);
  }

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link href={`/${locale}/crm/jobsite`} className="text-sm underline">{t('back')}</Link>
          <h1 className="text-xl font-bold">{projectName || t('title')}</h1>
        </div>
        <Button type="button" onClick={() => setSheetOpen(true)} disabled={!businessId}>{t('addPhoto')}</Button>
      </div>
      {!businessId && <p className="text-sm">{t('noBusiness')}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {photos.length === 0 && <p className="text-sm">{t('empty')}</p>}
      {[...groups.entries()].map(([day, dayPhotos]) => (
        <section key={day} className="space-y-2">
          <h2 className="font-bold">{day}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {dayPhotos.map((photo) => (
              <article key={photo.id} className="border-2 border-black rounded-lg p-3 bg-white">
                {photo.url && (photo.mimeType?.startsWith('video/') ? (
                  <video src={photo.url} controls playsInline className="w-full h-48 rounded mb-2 bg-black" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt="" className="w-full h-48 object-cover rounded mb-2" />
                ))}
                <p className="text-sm">{photo.caption || photo.name}</p>
                <p className="text-xs text-gray-600">{new Date(photo.takenAt).toLocaleTimeString()}</p>
                {photo.latitude != null && photo.longitude != null ? (
                  mapsKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="mt-2 w-full h-32 object-cover rounded border border-black"
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${photo.latitude},${photo.longitude}&zoom=15&size=400x160&markers=${photo.latitude},${photo.longitude}&key=${mapsKey}`}
                    />
                  ) : (
                    <p className="text-xs mt-1">{photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}</p>
                  )
                ) : (
                  <p className="text-xs mt-1">{t('noLocation')}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
      <JobCameraSession
        open={sheetOpen}
        mode="job"
        projectId={projectId}
        title={projectName || t('title')}
        onBack={() => setSheetOpen(false)}
        onFinished={() => {
          setSheetOpen(false);
          void load();
        }}
        onSave={saveCaptured}
      />
      <ProDriveQuotaModal usage={quota} onClose={() => setQuota(null)} />
    </div>
  );
}
