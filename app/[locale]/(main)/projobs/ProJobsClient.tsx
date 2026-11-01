'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Briefcase, Plus } from 'lucide-react';
import ShareBusinessModal from '@/components/businessdetails/ShareBusinessModal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import type { ProJob, ProJobEmployment, ProJobLanguage, ProJobWorkplace } from '@/lib/data/proJobs';
import ProJobCard from './ProJobCard';
import ProJobDetail from './ProJobDetail';
import ProJobPostModal from './ProJobPostModal';

function categoryTranslationKey(label: string): string {
  return label.toLowerCase();
}

export default function ProJobsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('proJobs');
  const tCategories = useTranslations('categories');
  const { roles, isAdmin, isLoading: authLoading, user } = useAuth();
  const canPost = !authLoading && (isAdmin || roles.includes('contractor'));
  const jobParam = searchParams.get('job');

  const [selectedId, setSelectedId] = useState<string | null>(jobParam);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [shareJob, setShareJob] = useState<ProJob | null>(null);
  const [catalog, setCatalog] = useState<ProJob[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [postOpen, setPostOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    setReady(true);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/projobs', { credentials: 'include' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { jobs?: ProJob[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'load');
        return data.jobs ?? [];
      })
      .then((nextJobs) => {
        if (!cancelled) setCatalog(nextJobs);
      })
      .catch(() => {
        if (!cancelled) setLoadError('load');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedId(jobParam);
  }, [jobParam]);

  const categoryLabel = useCallback(
    (label: string) => {
      if (label === 'All') return tCategories('all');
      return tCategories(categoryTranslationKey(label) as Parameters<typeof tCategories>[0]);
    },
    [tCategories]
  );

  const employmentLabel = useCallback(
    (id: ProJobEmployment) => {
      if (id === 'full_time') return t('fullTime');
      if (id === 'part_time') return t('partTime');
      if (id === 'contract') return t('contract');
      return t('hourly');
    },
    [t]
  );

  const workplaceLabel = useCallback(
    (id: ProJobWorkplace) => (id === 'hybrid' ? t('hybrid') : t('onSite')),
    [t]
  );

  const languageLabel = useCallback(
    (id: ProJobLanguage) => {
      if (id === 'en') return t('english');
      if (id === 'es') return t('spanish');
      return t('bilingual');
    },
    [t]
  );

  const jobs = catalog;

  const updateJobQuery = useCallback(
    (jobId: string | null) => {
      const params = new URLSearchParams();
      if (jobId) params.set('job', jobId);
      const qs = params.toString();
      router.replace(qs ? `/${locale}/projobs?${qs}` : `/${locale}/projobs`, { scroll: false });
    },
    [locale, router]
  );

  useEffect(() => {
    if (!ready || !loaded) return;
    const stillVisible = Boolean(selectedId && jobs.some((job) => job.id === selectedId));
    if (stillVisible) return;
    if (!isMobile && jobs.length > 0) {
      const nextId = jobs[0].id;
      setSelectedId(nextId);
      updateJobQuery(nextId);
      return;
    }
    if (selectedId) {
      setSelectedId(null);
      updateJobQuery(null);
    }
  }, [ready, loaded, isMobile, jobs, selectedId, updateJobQuery]);

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? null;
  const desktopSplit = ready && !isMobile;
  const showDetail = Boolean(selectedJob);
  const showList = desktopSplit || !showDetail;
  const showDetailPane = desktopSplit || showDetail;

  const handleSelect = (job: ProJob) => {
    setSelectedId(job.id);
    updateJobQuery(job.id);
  };

  const handlePosted = (job: ProJob) => {
    setCatalog((current) => [job, ...current.filter((item) => item.id !== job.id)]);
    setSelectedId(job.id);
    updateJobQuery(job.id);
  };

  const handleDelete = async (job: ProJob) => {
    const response = await fetch(`/api/projobs/${job.id}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) return;
    setCatalog((current) => current.filter((item) => item.id !== job.id));
    setSelectedId(null);
    updateJobQuery(null);
  };

  const postBar = canPost ? (
    <div className="flex shrink-0 justify-end p-1 md:p-2">
      <button
        type="button"
        onClick={() => setPostOpen(true)}
        className="flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-md border-2 border-black bg-black px-3 text-sm font-medium text-white hover:bg-gray-800"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">{t('postJob')}</span>
      </button>
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {showList ? (
          <div
            className={`flex min-h-0 w-full flex-col ${
              showDetailPane ? 'border-black pr-1 md:w-[30%] md:flex-none md:border-r-2 md:pr-2' : ''
            }`}
          >
            {postBar}
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {!loaded ? (
              <div className="flex h-full items-center justify-center py-12">
                <p className="text-sm text-gray-600">{t('loading')}</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-black">
                  <Briefcase className="h-8 w-8 text-black" />
                </div>
                <h2 className="text-xl font-bold text-black">{t('boardTitle')}</h2>
                <p className="max-w-xs text-sm text-gray-600">
                  {loadError
                    ? t('loadFailed')
                    : catalog.length === 0
                      ? canPost
                        ? t('emptyContractor')
                        : t('emptyPublic')
                      : t('noJobs')}
                </p>
                {catalog.length === 0 && canPost ? (
                  <Button type="button" className="inline-flex items-center" onClick={() => setPostOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    {t('postJob')}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {jobs.map((job) => (
                  <ProJobCard
                    key={job.id}
                    job={job}
                    selected={job.id === selectedId}
                    categoryLabel={categoryLabel(job.category)}
                    employmentLabel={employmentLabel(job.employmentType)}
                    onSelect={handleSelect}
                    onShare={setShareJob}
                  />
                ))}
              </div>
            )}
            </div>
          </div>
        ) : null}

        {showDetailPane ? (
          <div className="min-h-0 min-w-0 flex-1 bg-white">
            <ProJobDetail
              job={selectedJob}
              categoryLabel={selectedJob ? categoryLabel(selectedJob.category) : ''}
              employmentLabel={selectedJob ? employmentLabel(selectedJob.employmentType) : ''}
              workplaceLabel={selectedJob ? workplaceLabel(selectedJob.workplaceType) : ''}
              languageLabel={selectedJob ? languageLabel(selectedJob.workplaceLanguage) : ''}
              onBack={
                isMobile
                  ? () => {
                      setSelectedId(null);
                      updateJobQuery(null);
                    }
                  : undefined
              }
              onDelete={(job) => void handleDelete(job)}
            />
          </div>
        ) : null}
      </div>

      <ProJobPostModal
        isOpen={postOpen}
        onClose={() => setPostOpen(false)}
        companyName={user?.companyName}
        onPosted={handlePosted}
      />

      {shareJob ? (
        <ShareFromCard
          job={shareJob}
          locale={locale}
          categoryLabel={categoryLabel(shareJob.category)}
          title={t('shareJob')}
          onClose={() => setShareJob(null)}
        />
      ) : null}
    </div>
  );
}

function ShareFromCard({
  job,
  locale,
  categoryLabel,
  title,
  onClose,
}: {
  job: ProJob;
  locale: string;
  categoryLabel: string;
  title: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl(`${window.location.origin}/${locale}/projobs?job=${job.id}`);
  }, [job.id, locale]);

  return (
    <ShareBusinessModal
      isOpen
      onClose={onClose}
      title={title}
      businessName={job.title}
      contractorType={categoryLabel}
      businessUrl={url}
    />
  );
}
