import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import type { ProJob } from '@/lib/data/proJobs';

interface BusinessContact {
  business_name: string;
  phone: string | null;
  mobile_phone: string | null;
  is_active: boolean;
}

interface JobRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  employment_type: ProJob['employmentType'];
  workplace_type: ProJob['workplaceType'];
  workplace_language: ProJob['workplaceLanguage'];
  city: string;
  state: string;
  pay: string | null;
  businesses: BusinessContact | BusinessContact[] | null;
}

const JOB_SELECT = `
  id,
  owner_id,
  title,
  description,
  category,
  employment_type,
  workplace_type,
  workplace_language,
  city,
  state,
  pay,
  businesses!inner (
    business_name,
    phone,
    mobile_phone,
    is_active
  )
`;

function businessOf(row: JobRow): BusinessContact | null {
  if (!row.businesses) return null;
  return Array.isArray(row.businesses) ? row.businesses[0] ?? null : row.businesses;
}

function toProJob(row: JobRow, viewerId: string | null): ProJob | null {
  const business = businessOf(row);
  if (!business || !business.is_active) return null;
  const phone = (business.phone || business.mobile_phone || '').trim();
  return {
    id: row.id,
    company: business.business_name,
    title: row.title,
    description: row.description,
    category: row.category,
    employmentType: row.employment_type,
    workplaceType: row.workplace_type,
    workplaceLanguage: row.workplace_language,
    city: row.city,
    state: row.state,
    pay: row.pay,
    phone,
    mine: viewerId != null && viewerId === row.owner_id,
  };
}

async function queryPublishedJobs(): Promise<ProJob[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('pro_jobs')
    .select(JOB_SELECT)
    .eq('businesses.is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listPublishedJobs', error);
    return [];
  }

  return ((data ?? []) as unknown as JobRow[])
    .map((row) => toProJob(row, null))
    .filter((job): job is ProJob => job != null);
}

const getCachedPublishedJobs = unstable_cache(queryPublishedJobs, ['published-pro-jobs'], {
  revalidate: 60,
});

export function listPublishedJobs(): Promise<ProJob[]> {
  return getCachedPublishedJobs();
}
