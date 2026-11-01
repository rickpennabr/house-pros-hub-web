'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SERVICE_CATEGORIES } from '@/lib/constants/categories';
import type { ProJob, ProJobEmployment, ProJobLanguage, ProJobWorkplace } from '@/lib/data/proJobs';

interface ProJobPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName?: string;
  onPosted: (job: ProJob) => void;
}

const fieldClass = 'w-full';

function errorKey(code: string): 'contractorOnly' | 'businessRequired' | 'phoneRequired' | null {
  if (code === 'contractor_required') return 'contractorOnly';
  if (code === 'business_required') return 'businessRequired';
  if (code === 'phone_required') return 'phoneRequired';
  return null;
}

export default function ProJobPostModal({
  isOpen,
  onClose,
  companyName,
  onPosted,
}: ProJobPostModalProps) {
  const t = useTranslations('proJobs');
  const tCategories = useTranslations('categories');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [employmentType, setEmploymentType] = useState<ProJobEmployment>('full_time');
  const [workplaceType, setWorkplaceType] = useState<ProJobWorkplace>('on_site');
  const [workplaceLanguage, setWorkplaceLanguage] = useState<ProJobLanguage>('bilingual');
  const [city, setCity] = useState('');
  const [state, setState] = useState('NV');
  const [pay, setPay] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!category) {
      setError(t('categoryRequired'));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/projobs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          employmentType,
          workplaceType,
          workplaceLanguage,
          city,
          state,
          pay,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; job?: ProJob };
      if (!response.ok || !data.job) {
        const code = data.error ?? '';
        const key = errorKey(code);
        setError(key ? t(key) : code || t('postFailed'));
        return;
      }
      onPosted(data.job);
      onClose();
    } catch {
      setError(t('postFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('postJob')}
      showHeader
      maxWidth="lg"
      contentClassName="p-0"
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 p-4">
        {companyName ? (
          <p className="text-sm text-gray-700">
            {t('postingAs')} <span className="font-semibold text-black">{companyName}</span>
          </p>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-sm font-bold text-black">{t('jobTitle')}</span>
          <Input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold text-black">{t('description')}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            minLength={10}
            maxLength={4000}
            rows={4}
            className="w-full rounded-lg border-2 border-black bg-white px-2 py-3 text-black focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold text-black">{t('trade')}</span>
          <Select value={category} onChange={(event) => setCategory(event.target.value)} required>
            <option value="">{t('chooseTrade')}</option>
            {SERVICE_CATEGORIES.map((item) => (
              <option key={item.label} value={item.label}>
                {tCategories(item.label.toLowerCase() as Parameters<typeof tCategories>[0])}
              </option>
            ))}
          </Select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-black">{t('employment')}</span>
            <Select
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value as ProJobEmployment)}
            >
              <option value="full_time">{t('fullTime')}</option>
              <option value="part_time">{t('partTime')}</option>
              <option value="contract">{t('contract')}</option>
              <option value="hourly">{t('hourly')}</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-black">{t('workplace')}</span>
            <Select
              value={workplaceType}
              onChange={(event) => setWorkplaceType(event.target.value as ProJobWorkplace)}
            >
              <option value="on_site">{t('onSite')}</option>
              <option value="hybrid">{t('hybrid')}</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-black">{t('language')}</span>
            <Select
              value={workplaceLanguage}
              onChange={(event) => setWorkplaceLanguage(event.target.value as ProJobLanguage)}
            >
              <option value="en">{t('english')}</option>
              <option value="es">{t('spanish')}</option>
              <option value="bilingual">{t('bilingual')}</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-black">{t('pay')}</span>
            <Input
              className={fieldClass}
              value={pay}
              onChange={(event) => setPay(event.target.value)}
              maxLength={40}
              placeholder={t('payPlaceholder')}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-black">{t('city')}</span>
            <Input className={fieldClass} value={city} onChange={(event) => setCity(event.target.value)} required maxLength={80} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-black">{t('state')}</span>
            <Input
              className={fieldClass}
              value={state}
              onChange={(event) => setState(event.target.value.toUpperCase())}
              required
              maxLength={2}
            />
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="w-full" loading={saving}>
          {t('postJob')}
        </Button>
      </form>
    </Modal>
  );
}
