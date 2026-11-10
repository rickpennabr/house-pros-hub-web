'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProCamCaptureSheet } from '@/components/media/ProCamCaptureSheet';
import { uploadProDriveFile, ProDriveQuotaClientError } from '@/lib/drive/upload-client';
import type { CaptureLocation } from '@/lib/media/capture-location';
import { jobLocationAllowed, setJobCameraAllowed } from '@/lib/media/job-camera-prefs';

interface JobRow {
  id: string;
  name: string;
}

interface Shot {
  file: File;
  location: CaptureLocation | null;
}

interface JobSiteCameraProps {
  open: boolean;
  onClose: () => void;
}

/** Desktop JOB camera. Opens the viewfinder immediately, then saves the photo on a job. */
export function JobSiteCamera({ open, onClose }: JobSiteCameraProps) {
  const t = useTranslations('jobsite');
  const [shot, setShot] = useState<Shot | null>(null);
  const [projects, setProjects] = useState<JobRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useLocation, setUseLocation] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUseLocation(jobLocationAllowed());
    setShot(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!shot) return;
    void fetch('/api/crm/projects?pageSize=100', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { projects?: { id: string; name: string }[] }) => {
        setProjects((body.projects ?? []).map((project) => ({ id: project.id, name: project.name })));
      })
      .catch(() => setError(t('loadFailed')));
  }, [shot, t]);

  const save = async (projectId: string) => {
    if (!shot) return;
    setSavingId(projectId);
    setError(null);
    try {
      const infoResponse = await fetch(`/api/crm/projects/${projectId}/photos`, { credentials: 'include' });
      const info = (await infoResponse.json()) as {
        businessId?: string | null;
        project?: { displayId?: string };
        error?: string;
      };
      if (!infoResponse.ok || !info.businessId || !info.project?.displayId) {
        throw new Error(info.error || t('noBusiness'));
      }
      const saved = await uploadProDriveFile({
        file: shot.file,
        ownerType: 'business',
        ownerId: info.businessId,
        ensureFolderNames: ['Jobsites', info.project.displayId],
      });
      const response = await fetch(`/api/crm/projects/${projectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driveFileId: saved.id,
          takenAt: new Date().toISOString(),
          latitude: shot.location?.latitude ?? null,
          longitude: shot.location?.longitude ?? null,
          accuracyM: shot.location?.accuracyM ?? null,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || t('saveFailed'));
      }
      setShot(null);
      onClose();
    } catch (saveError) {
      if (saveError instanceof ProDriveQuotaClientError) setError(t('saveFailed'));
      else setError(saveError instanceof Error ? saveError.message : t('saveFailed'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <ProCamCaptureSheet
        isOpen={open && !shot}
        autoStart
        withLocation={useLocation}
        onCameraReady={() => setJobCameraAllowed(true)}
        onClose={onClose}
        onCapture={(result) => setShot(result)}
      />
      <Modal isOpen={Boolean(shot)} onClose={() => { setShot(null); onClose(); }} title={t('pickJob')} showHeader showCloseButton maxWidth="md">
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {projects.length === 0 && !error && <p className="text-sm">{t('noJobs')}</p>}
          <ul className="space-y-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={savingId !== null}
                  onClick={() => void save(project.id)}
                >
                  {savingId === project.id ? t('saving') : project.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
}
