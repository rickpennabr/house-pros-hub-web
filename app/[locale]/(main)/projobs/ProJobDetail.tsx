'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Briefcase, MapPin, Phone, Share2, Tag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ShareBusinessModal from '@/components/businessdetails/ShareBusinessModal';
import { useAuth } from '@/contexts/AuthContext';
import { jobInitials, type ProJob } from '@/lib/data/proJobs';

interface JobApplication {
  id: string;
  createdAt: string;
  resume: {
    fullName: string;
    headline: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    summary: string;
    skills: string[];
  };
}

interface ProJobDetailProps {
  job: ProJob | null;
  categoryLabel: string;
  employmentLabel: string;
  workplaceLabel: string;
  languageLabel: string;
  onBack?: () => void;
  onDelete?: (job: ProJob) => void;
}

export default function ProJobDetail({
  job,
  categoryLabel,
  employmentLabel,
  workplaceLabel,
  languageLabel,
  onBack,
  onDelete,
}: ProJobDetailProps) {
  const t = useTranslations('proJobs');
  const locale = useLocale();
  const { user, roles, isLoading: authLoading } = useAuth();
  const isInstaller = (roles as string[]).includes('installer');
  const [shareOpen, setShareOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [applyState, setApplyState] = useState<'loading' | 'ready' | 'incomplete' | 'applied' | 'error'>('loading');
  const [sending, setSending] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>([]);

  useEffect(() => {
    if (!job) return;
    setShareUrl(`${window.location.origin}/${locale}/projobs?job=${job.id}`);
    setApplyOpen(false);
    setShareOpen(false);
    setDeleteOpen(false);
    setApplications([]);
  }, [job, locale]);

  useEffect(() => {
    if (!job?.mine || !user) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/projobs/${job.id}/applications`);
      const body = await response.json().catch(() => null);
      if (!cancelled && response.ok && Array.isArray(body?.applications)) {
        setApplications(body.applications as JobApplication[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, user]);

  useEffect(() => {
    if (!applyOpen || !job || authLoading || !user || !isInstaller) return;
    let cancelled = false;
    setApplyState('loading');
    (async () => {
      const response = await fetch(`/api/projobs/${job.id}/apply`);
      const body = await response.json().catch(() => null);
      if (cancelled) return;
      if (!response.ok) setApplyState('error');
      else if (body?.applied) setApplyState('applied');
      else if (body?.ready) setApplyState('ready');
      else setApplyState('incomplete');
    })();
    return () => {
      cancelled = true;
    };
  }, [applyOpen, authLoading, isInstaller, job, user]);

  async function sendApplication() {
    if (!job) return;
    setSending(true);
    const response = await fetch(`/api/projobs/${job.id}/apply`, { method: 'POST' });
    const body = await response.json().catch(() => null);
    setSending(false);
    if (response.status === 409 || body?.error === 'already_applied') {
      setApplyState('applied');
      return;
    }
    if (!response.ok) {
      setApplyState(body?.error === 'resume_incomplete' ? 'incomplete' : 'error');
      return;
    }
    setApplyState('applied');
  }

  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-600">
        <Briefcase className="h-12 w-12 text-black/30" />
        <p className="text-sm">{t('selectJob')}</p>
      </div>
    );
  }

  const pay = job.pay || t('payNotListed');
  const phoneDigits = job.phone.replace(/\D/g, '');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b-2 border-black bg-white px-2 py-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-black hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </button>
        ) : null}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-black">
          <span className="text-xs font-bold text-white">{jobInitials(job.company)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-black">{job.company}</p>
          <h2 className="truncate text-xs font-medium text-gray-600">{job.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100"
          aria-label={t('share')}
        >
          <Share2 className="h-5 w-5 text-black" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <div className="space-y-4 rounded-lg border-2 border-black p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <Tag className="h-4 w-4 shrink-0 text-black" />
            <span>{categoryLabel}</span>
            <span>•</span>
            <span>{employmentLabel}</span>
            <span>•</span>
            <span>{workplaceLabel}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-black px-2 py-1 text-xs font-semibold uppercase text-white">
              {t('easyApply')}
            </span>
            <span className="rounded-lg border-2 border-black px-2 py-1 text-xs font-semibold text-black">
              {languageLabel}
            </span>
          </div>

          <div>
            <h3 className="font-semibold text-black">{t('description')}</h3>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{job.description}</p>
          </div>

          <p className="flex items-center gap-2 text-sm text-gray-800">
            <MapPin className="h-4 w-4 shrink-0 text-black" />
            <span>
              {job.city}, {job.state}
            </span>
          </p>

          <p className="text-lg font-bold text-black">{pay}</p>

          {!job.mine ? (
            <Button type="button" className="w-full" onClick={() => setApplyOpen(true)}>
              {t('easyApply')}
            </Button>
          ) : null}
          {phoneDigits ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = `tel:${phoneDigits}`;
              }}
            >
              <Phone className="mr-2 h-4 w-4" />
              {t('call')}
            </Button>
          ) : null}
          {job.mine ? (
            <div className="space-y-2 border-t-2 border-black pt-3">
              <h3 className="font-semibold text-black">{t('applications')}</h3>
              {applications.length === 0 ? <p className="text-sm text-gray-600">{t('noApplications')}</p> : null}
              {applications.map((application) => (
                <div key={application.id} className="rounded-lg border-2 border-black p-2 text-sm">
                  <p className="font-semibold">{application.resume.fullName || t('unnamedApplicant')}</p>
                  {application.resume.headline ? <p className="text-gray-700">{application.resume.headline}</p> : null}
                  <p className="text-gray-700">
                    {[application.resume.email, application.resume.phone].filter(Boolean).join(' · ')}
                  </p>
                  {application.resume.skills.length > 0 ? (
                    <p className="mt-1 text-gray-800">{application.resume.skills.join(', ')}</p>
                  ) : null}
                  {application.resume.summary ? (
                    <p className="mt-1 whitespace-pre-wrap text-gray-800">{application.resume.summary}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {job.mine && onDelete ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setDeleteOpen(true)}>
              {t('deleteJob')}
            </Button>
          ) : null}
        </div>
      </div>

      <ShareBusinessModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={t('shareJob')}
        businessName={job.title}
        contractorType={categoryLabel}
        businessUrl={shareUrl}
      />

      <Modal
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        title={t('applyTitle')}
        showHeader
        maxWidth="md"
      >
        {!authLoading && !user ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-gray-800">{t('applyNeedSignIn')}</p>
            <Link href={`/${locale}/signin?returnUrl=${encodeURIComponent(`/${locale}/projobs?job=${job.id}`)}`}>
              <Button type="button" className="w-full">
                {t('applySignIn')}
              </Button>
            </Link>
          </div>
        ) : null}
        {user && !isInstaller ? <p className="text-sm leading-relaxed text-gray-800">{t('applyInstallerOnly')}</p> : null}
        {user && isInstaller && applyState === 'loading' ? <p className="text-sm text-gray-600">{t('applyChecking')}</p> : null}
        {user && isInstaller && applyState === 'incomplete' ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-gray-800">{t('applyNeedResume')}</p>
            <Link href={`/${locale}/proresume`}>
              <Button type="button" className="w-full">
                {t('applyOpenResume')}
              </Button>
            </Link>
          </div>
        ) : null}
        {user && isInstaller && applyState === 'ready' ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-gray-800">{t('applyReady')}</p>
            <Button type="button" className="w-full" disabled={sending} onClick={() => void sendApplication()}>
              {t('applySend')}
            </Button>
          </div>
        ) : null}
        {user && isInstaller && applyState === 'applied' ? (
          <p className="text-sm leading-relaxed text-gray-800">{t('applySent')}</p>
        ) : null}
        {user && isInstaller && applyState === 'error' ? (
          <p className="text-sm leading-relaxed text-gray-800">{t('applyFailed')}</p>
        ) : null}
      </Modal>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('deleteJob')}
        showHeader
        maxWidth="sm"
      >
        <p className="text-sm leading-relaxed text-gray-800">{t('deleteConfirm')}</p>
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              setDeleteOpen(false);
              onDelete?.(job);
            }}
          >
            {t('deleteJob')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
