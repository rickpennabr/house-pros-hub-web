'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileUp, Plus, Send, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { emptyProResume, newEntryId, type ProResume } from '@/lib/resume/pro-resume';

interface ChatLine {
  role: 'user' | 'assistant';
  text: string;
}

const fieldClass = 'w-full border-2 border-black rounded-lg bg-white p-2 text-sm text-black';

function withSkills(resume: ProResume, skillsText: string): ProResume {
  return {
    ...resume,
    skills: skillsText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 30),
  };
}

export default function ProResumeClient() {
  const t = useTranslations('proResume');
  const locale = useLocale();
  const { user, roles, isLoading } = useAuth();
  const isInstaller = (roles as string[]).includes('installer');
  const [resume, setResume] = useState<ProResume>(emptyProResume());
  const [skillsText, setSkillsText] = useState('');
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const applyResume = useCallback((next: ProResume) => {
    setResume(next);
    setSkillsText(next.skills.join(', '));
  }, []);

  useEffect(() => {
    if (isLoading || !user || !isInstaller) return;
    let cancelled = false;
    (async () => {
      const response = await fetch('/api/proresume');
      const body = await response.json().catch(() => null);
      if (cancelled) return;
      if (response.ok && body?.resume) applyResume(body.resume as ProResume);
      else setStatus(t('loadFailed'));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyResume, isInstaller, isLoading, user]);

  async function save() {
    setBusy(true);
    setStatus('');
    const next = withSkills(resume, skillsText);
    const response = await fetch('/api/proresume', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: next }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !body?.resume) {
      setStatus(t('saveFailed'));
      return;
    }
    applyResume(body.resume as ProResume);
    setStatus(t('saved'));
  }

  async function upload(file: File) {
    setBusy(true);
    setStatus('');
    const form = new FormData();
    form.set('file', file);
    form.set('resume', JSON.stringify(withSkills(resume, skillsText)));
    const response = await fetch('/api/proresume/import', { method: 'POST', body: form });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !body?.resume) {
      setStatus(typeof body?.error === 'string' ? body.error : t('importFailed'));
      return;
    }
    applyResume(body.resume as ProResume);
    if (typeof body.reply === 'string' && body.reply) {
      setMessages((current) => [...current, { role: 'assistant', text: body.reply }]);
    }
    setStatus(t('imported'));
  }

  async function ask() {
    const message = draft.trim();
    if (message.length < 2 || busy) return;
    setDraft('');
    setMessages((current) => [...current, { role: 'user', text: message }]);
    setBusy(true);
    const response = await fetch('/api/proresume/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, resume: withSkills(resume, skillsText) }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok || !body?.resume) {
      setMessages((current) => [...current, { role: 'assistant', text: t('assistFailed') }]);
      return;
    }
    applyResume(body.resume as ProResume);
    setMessages((current) => [
      ...current,
      { role: 'assistant', text: typeof body.reply === 'string' ? body.reply : t('assistUpdated') },
    ]);
  }

  if (isLoading || (user && isInstaller && !loaded)) {
    return <div className="min-h-0 flex-1" />;
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3 rounded-lg border-2 border-black p-4">
          <p className="text-sm text-gray-800">{t('signIn')}</p>
          <Link href={`/${locale}/signin?returnUrl=${encodeURIComponent(`/${locale}/proresume`)}`}>
            <Button type="button" className="w-full">
              {t('signInAction')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isInstaller) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="max-w-md rounded-lg border-2 border-black p-4 text-sm text-gray-800">{t('installerOnly')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 lg:flex-row">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border-2 border-black p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-black">{t('title')}</h1>
            <p className="text-xs text-gray-600">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-2 border-black px-3 py-2 text-sm font-medium">
              <FileUp className="h-4 w-4" />
              {t('upload')}
              <input
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void upload(file);
                }}
              />
            </label>
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {t('save')}
            </Button>
          </div>
        </div>
        {status ? <p className="text-sm text-gray-700">{status}</p> : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold">
            {t('fullName')}
            <Input value={resume.fullName} onChange={(event) => setResume({ ...resume, fullName: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            {t('headline')}
            <Input value={resume.headline} onChange={(event) => setResume({ ...resume, headline: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            {t('email')}
            <Input value={resume.email} onChange={(event) => setResume({ ...resume, email: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            {t('phone')}
            <Input value={resume.phone} onChange={(event) => setResume({ ...resume, phone: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            {t('city')}
            <Input value={resume.city} onChange={(event) => setResume({ ...resume, city: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            {t('state')}
            <Input
              value={resume.state}
              maxLength={2}
              onChange={(event) => setResume({ ...resume, state: event.target.value.toUpperCase() })}
            />
          </label>
        </div>

        <label className="block space-y-1 text-xs font-semibold">
          {t('summary')}
          <textarea
            className={fieldClass}
            rows={4}
            value={resume.summary}
            onChange={(event) => setResume({ ...resume, summary: event.target.value })}
          />
        </label>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('experience')}</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium"
              onClick={() =>
                setResume({
                  ...resume,
                  experience: [
                    ...resume.experience,
                    { id: newEntryId(), title: '', company: '', city: '', startDate: '', endDate: '', current: false, description: '' },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              {t('addJob')}
            </button>
          </div>
          {resume.experience.map((job, index) => (
            <div key={job.id} className="space-y-2 rounded-lg border-2 border-black p-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={job.title}
                  placeholder={t('jobTitle')}
                  onChange={(event) => {
                    const experience = resume.experience.slice();
                    experience[index] = { ...job, title: event.target.value };
                    setResume({ ...resume, experience });
                  }}
                />
                <Input
                  value={job.company}
                  placeholder={t('company')}
                  onChange={(event) => {
                    const experience = resume.experience.slice();
                    experience[index] = { ...job, company: event.target.value };
                    setResume({ ...resume, experience });
                  }}
                />
                <Input
                  value={job.startDate}
                  placeholder={t('startDate')}
                  onChange={(event) => {
                    const experience = resume.experience.slice();
                    experience[index] = { ...job, startDate: event.target.value };
                    setResume({ ...resume, experience });
                  }}
                />
                <Input
                  value={job.current ? t('present') : job.endDate}
                  placeholder={t('endDate')}
                  disabled={job.current}
                  onChange={(event) => {
                    const experience = resume.experience.slice();
                    experience[index] = { ...job, endDate: event.target.value };
                    setResume({ ...resume, experience });
                  }}
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={job.current}
                  onChange={(event) => {
                    const experience = resume.experience.slice();
                    experience[index] = { ...job, current: event.target.checked, endDate: event.target.checked ? '' : job.endDate };
                    setResume({ ...resume, experience });
                  }}
                />
                {t('currentJob')}
              </label>
              <textarea
                className={fieldClass}
                rows={3}
                placeholder={t('jobDescription')}
                value={job.description}
                onChange={(event) => {
                  const experience = resume.experience.slice();
                  experience[index] = { ...job, description: event.target.value };
                  setResume({ ...resume, experience });
                }}
              />
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-red-600"
                onClick={() =>
                  setResume({ ...resume, experience: resume.experience.filter((item) => item.id !== job.id) })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('remove')}
              </button>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('education')}</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium"
              onClick={() =>
                setResume({
                  ...resume,
                  education: [...resume.education, { id: newEntryId(), school: '', credential: '', endDate: '' }],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              {t('addSchool')}
            </button>
          </div>
          {resume.education.map((school, index) => (
            <div key={school.id} className="grid gap-2 rounded-lg border-2 border-black p-2 sm:grid-cols-2">
              <Input
                value={school.school}
                placeholder={t('school')}
                onChange={(event) => {
                  const education = resume.education.slice();
                  education[index] = { ...school, school: event.target.value };
                  setResume({ ...resume, education });
                }}
              />
              <Input
                value={school.credential}
                placeholder={t('credential')}
                onChange={(event) => {
                  const education = resume.education.slice();
                  education[index] = { ...school, credential: event.target.value };
                  setResume({ ...resume, education });
                }}
              />
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-red-600 sm:col-span-2"
                onClick={() =>
                  setResume({ ...resume, education: resume.education.filter((item) => item.id !== school.id) })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('remove')}
              </button>
            </div>
          ))}
        </section>

        <label className="block space-y-1 text-xs font-semibold">
          {t('skills')}
          <Input value={skillsText} placeholder={t('skillsHint')} onChange={(event) => setSkillsText(event.target.value)} />
        </label>
      </div>

      <aside className="flex min-h-[18rem] w-full min-w-0 flex-col rounded-lg border-2 border-black lg:w-[340px]">
        <div className="border-b-2 border-black px-3 py-2">
          <h2 className="text-sm font-semibold">{t('assistant')}</h2>
          <p className="text-xs text-gray-600">{t('assistantHint')}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {messages.length === 0 ? <p className="text-sm text-gray-600">{t('assistantEmpty')}</p> : null}
          {messages.map((line, index) => (
            <p
              key={`${line.role}-${index}`}
              className={`rounded-lg px-2 py-1.5 text-sm ${line.role === 'user' ? 'bg-black text-white' : 'border-2 border-black'}`}
            >
              {line.text}
            </p>
          ))}
        </div>
        <form
          className="flex gap-2 border-t-2 border-black p-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <Input
            value={draft}
            placeholder={t('assistantPlaceholder')}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" disabled={busy || draft.trim().length < 2} aria-label={t('send')}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </aside>
    </div>
  );
}
