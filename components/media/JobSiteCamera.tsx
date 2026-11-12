'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { JobCameraSession } from '@/components/media/JobCameraSession';
import { JobCustomerAlbum } from '@/components/media/JobCustomerAlbum';
import { ProCamCaptureSheet } from '@/components/media/ProCamCaptureSheet';
import { usePhone } from '@/lib/media/use-phone';
import { uploadProDriveFile, ProDriveQuotaClientError } from '@/lib/drive/upload-client';
import { geocodeAddress, locateShot, readCompassHeading, type PhotoSpot } from '@/lib/media/photo-spot';
import { requestCurrentLocation } from '@/lib/media/capture-location';
import type { CaptureLocation } from '@/lib/media/capture-location';
import { jobLocationAllowed, setJobCameraAllowed } from '@/lib/media/job-camera-prefs';

interface CustomerRow {
  id: string;
  name: string;
  address: string;
}

interface ChosenCustomer extends CustomerRow {
  projectId: string;
}

interface CustomerApiRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  company_name?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  billing_address_street_1?: string | null;
  billing_address_city?: string | null;
  billing_address_state?: string | null;
  billing_address_zip_code?: string | null;
}

interface ProjectApiRow {
  id: string;
  customer_id: string;
  status: string;
  updated_at: string;
}

interface JobSiteCameraProps {
  open: boolean;
  onClose: () => void;
}

function customerName(row: CustomerApiRow): string {
  const display = row.display_name?.trim();
  if (display) return display;
  const person = [row.first_name, row.last_name].map((part) => part?.trim() ?? '').filter(Boolean).join(' ');
  if (person) return person;
  return row.company_name?.trim() || 'Customer';
}

function customerAddress(row: CustomerApiRow): string {
  const street = row.street_address?.trim() || row.billing_address_street_1?.trim() || '';
  const city = row.city?.trim() || row.billing_address_city?.trim() || '';
  const state = row.state?.trim() || row.billing_address_state?.trim() || '';
  const zip = row.zip_code?.trim() || row.billing_address_zip_code?.trim() || '';
  const place = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, place].filter(Boolean).join(' · ');
}

function projectRank(status: string): number {
  if (status === 'in_progress') return 0;
  if (status === 'planned') return 1;
  return 2;
}

/** JOB camera. Pick the customer, see their photos, then open the camera to add more. */
export function JobSiteCamera({ open, onClose }: JobSiteCameraProps) {
  const t = useTranslations('jobsite');
  const phone = usePhone();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChosenCustomer | null>(null);
  const [shooting, setShooting] = useState(false);
  const [afterOf, setAfterOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [useLocation, setUseLocation] = useState(false);
  const [covers, setCovers] = useState<Record<string, { url: string; mimeType: string }>>({});

  useEffect(() => {
    if (!open) return;
    setUseLocation(jobLocationAllowed());
    setSelected(null);
    setShooting(false);
    setAfterOf(null);
    setQuery('');
    setError(null);
    setNotice(null);
    setPickingId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetch('/api/crm/customers?pageSize=100&sortBy=updated_at&sortDir=desc', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { customers?: CustomerApiRow[]; error?: string }) => {
        if (cancelled) return;
        if (!Array.isArray(body.customers)) {
          setError(body.error || t('loadFailed'));
          setCustomers([]);
          return;
        }
        setCustomers(body.customers.map((row) => ({
          id: row.id,
          name: customerName(row),
          address: customerAddress(row),
        })));
      })
      .catch(() => {
        if (!cancelled) setError(t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  useEffect(() => {
    if (!open || selected) return;
    let cancelled = false;
    void fetch('/api/crm/projects/covers', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { covers?: { customerId: string; url: string; mimeType: string }[] }) => {
        if (cancelled || !Array.isArray(body.covers)) return;
        const next: Record<string, { url: string; mimeType: string }> = {};
        for (const cover of body.covers) next[cover.customerId] = { url: cover.url, mimeType: cover.mimeType };
        setCovers(next);
      })
      .catch(() => {
        if (!cancelled) setCovers({});
      });
    return () => {
      cancelled = true;
    };
  }, [open, selected]);

  const ensureProject = async (customer: CustomerRow): Promise<string> => {
    const response = await fetch(
      `/api/crm/projects?pageSize=100&search=${encodeURIComponent(customer.name)}`,
      { credentials: 'include' }
    );
    const body = (await response.json()) as { projects?: ProjectApiRow[]; error?: string };
    if (!response.ok) throw new Error(body.error || t('loadFailed'));
    const mine = (body.projects ?? [])
      .filter((project) => project.customer_id === customer.id && project.status !== 'cancelled')
      .sort((a, b) => projectRank(a.status) - projectRank(b.status) || b.updated_at.localeCompare(a.updated_at));
    if (mine[0]) return mine[0].id;

    const created = await fetch('/api/crm/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ customerId: customer.id, name: customer.name, status: 'in_progress' }),
    });
    const createdBody = (await created.json()) as { id?: string; error?: string };
    if (!created.ok || !createdBody.id) throw new Error(createdBody.error || t('saveFailed'));
    return createdBody.id;
  };

  const choose = async (customer: CustomerRow) => {
    setPickingId(customer.id);
    setError(null);
    setNotice(null);
    try {
      const projectId = await ensureProject(customer);
      setSelected({ ...customer, projectId });
    } catch (chooseError) {
      setError(chooseError instanceof Error ? chooseError.message : t('loadFailed'));
    } finally {
      setPickingId(null);
    }
  };

  const saveFiles = async (items: { file: File; caption: string }[]) => {
    if (!selected || items.length === 0) return;
    const infoResponse = await fetch(`/api/crm/projects/${selected.projectId}/photos`, { credentials: 'include' });
    const info = (await infoResponse.json()) as {
      businessId?: string | null;
      project?: { displayId?: string };
      error?: string;
    };
    if (!infoResponse.ok || !info.businessId || !info.project?.displayId) {
      throw new Error(info.error || t('noBusiness'));
    }
    try {
    const live = window.isSecureContext ? await requestCurrentLocation() : null;
    const heading = window.isSecureContext ? await readCompassHeading() : null;
    let addressSpot: PhotoSpot | null | undefined;
    let linkedAfter = false;
    for (const item of items) {
      let spot = await locateShot(item.file, '', live, heading);
      if (!spot) {
        if (addressSpot === undefined) addressSpot = await geocodeAddress(selected.address);
        spot = addressSpot;
      }
      const saved = await uploadProDriveFile({
        file: item.file,
        ownerType: 'business',
        ownerId: info.businessId,
        ensureFolderNames: ['Jobsites', info.project.displayId],
      });
      const response = await fetch(`/api/crm/projects/${selected.projectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driveFileId: saved.id,
          caption: item.caption,
          takenAt: new Date().toISOString(),
          latitude: spot?.latitude ?? null,
          longitude: spot?.longitude ?? null,
          accuracyM: spot?.accuracyM ?? null,
          headingDeg: spot?.headingDeg ?? null,
          pairedPhotoId: !linkedAfter ? afterOf : null,
        }),
      });
      linkedAfter = true;
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || t('saveFailed'));
      }
    }
    } catch (saveError) {
      if (saveError instanceof ProDriveQuotaClientError) throw new Error(t('saveFailed'));
      throw saveError;
    }
  };

  const save = async (file: File, location: CaptureLocation | null) => {
    if (!selected) return;
    setError(null);
    setNotice(null);
    try {
      const infoResponse = await fetch(`/api/crm/projects/${selected.projectId}/photos`, { credentials: 'include' });
      const info = (await infoResponse.json()) as {
        businessId?: string | null;
        project?: { displayId?: string };
        error?: string;
      };
      if (!infoResponse.ok || !info.businessId || !info.project?.displayId) {
        throw new Error(info.error || t('noBusiness'));
      }
      const saved = await uploadProDriveFile({
        file,
        ownerType: 'business',
        ownerId: info.businessId,
        ensureFolderNames: ['Jobsites', info.project.displayId],
      });
      const response = await fetch(`/api/crm/projects/${selected.projectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driveFileId: saved.id,
          takenAt: new Date().toISOString(),
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          accuracyM: location?.accuracyM ?? null,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || t('saveFailed'));
      }
      setNotice(t('photoSaved'));
    } catch (saveError) {
      if (saveError instanceof ProDriveQuotaClientError) setError(t('saveFailed'));
      else setError(saveError instanceof Error ? saveError.message : t('saveFailed'));
      throw saveError;
    }
  };

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? customers.filter((customer) => `${customer.name} ${customer.address}`.toLowerCase().includes(needle))
    : customers;

  return (
    <>
      <Modal
        isOpen={open && !selected}
        onClose={onClose}
        title={t('chooseCustomer')}
        showHeader
        showCloseButton
        maxWidth="lg"
        contentClassName="p-0"
      >
        <div className="border-b-2 border-black p-3">
          <p className="mb-2 text-sm font-bold">{t('recent')}</p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchCustomers')}
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
            aria-label={t('searchCustomers')}
          />
        </div>
        <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto p-3 md:max-h-[60vh]">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm">{t('loadingCustomers')}</p>}
          {!loading && visible.length === 0 && (
            <p className="text-sm">{needle ? t('noCustomerMatches') : t('noCustomers')}</p>
          )}
          <ul className="space-y-2">
            {visible.map((customer) => {
              const cover = covers[customer.id];
              return (
              <li key={customer.id}>
                <button
                  type="button"
                  disabled={pickingId !== null}
                  onClick={() => void choose(customer)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg border-2 border-black bg-white p-2 text-left disabled:opacity-50"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-200 text-gray-500">
                    {cover?.url && cover.mimeType.startsWith('video/') ? (
                      <video src={cover.url} muted playsInline className="h-full w-full object-cover" />
                    ) : cover?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{customer.name}</span>
                    {customer.address ? (
                      <span className="block truncate text-sm text-gray-600">{customer.address}</span>
                    ) : null}
                    {pickingId === customer.id ? (
                      <span className="block text-xs text-gray-500">{t('openingCustomer')}</span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
                </button>
              </li>
              );
            })}
          </ul>
        </div>
      </Modal>
      {selected ? (
        <JobCustomerAlbum
          open={open && !shooting}
          projectId={selected.projectId}
          name={selected.name}
          address={selected.address}
          customerId={selected.id}
          onBack={() => {
            setSelected(null);
            setShooting(false);
            setAfterOf(null);
            setNotice(null);
            setError(null);
          }}
          onCamera={() => {
            setAfterOf(null);
            setShooting(true);
          }}
          onTakeAfter={(photoId) => {
            setAfterOf(photoId);
            setShooting(true);
          }}
          onUpload={async (files) => {
            await saveFiles(files.map((file) => ({ file, caption: '' })));
          }}
        />
      ) : null}
      {phone ? (
        <JobCameraSession
          open={open && Boolean(selected) && shooting}
          projectId={selected?.projectId}
          title={selected?.name ?? ''}
          subtitle={selected?.address}
          onBack={() => {
            setShooting(false);
            setAfterOf(null);
            setNotice(null);
            setError(null);
          }}
          onFinished={() => {
            setShooting(false);
            setAfterOf(null);
            setNotice(null);
            setError(null);
          }}
          onSave={saveFiles}
        />
      ) : (
      <ProCamCaptureSheet
        isOpen={open && Boolean(selected) && shooting}
        title={selected?.name}
        intro={selected?.address}
        notice={notice}
        error={error}
        withLocation={useLocation}
        closeOnCapture={false}
        onCameraReady={() => setJobCameraAllowed(true)}
        onClose={() => {
          setShooting(false);
          setAfterOf(null);
          setNotice(null);
          setError(null);
        }}
        onCapture={({ file, location }) => save(file, location)}
      />
      )}
    </>
  );
}
