'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Gift, Pencil, Plus, Star } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { SimpleConfirmDialog } from '@/components/ui/SimpleConfirmDialog';

interface Plan {
  slug: string;
  name: string;
  tagline: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  included_users: number | null;
  extra_user_price_cents: number;
  storage_gb: number;
  protrades_limit: number | null;
  trial_days: number;
  features: string[];
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
  stripe_product_id: string | null;
  stripe_monthly_price_id: string | null;
  stripe_yearly_price_id: string | null;
}

interface CompanySub {
  user_id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  plan: string;
  planName: string;
  status: string;
  granted: boolean;
  billing_interval: 'month' | 'year' | null;
  cancel_at_period_end: boolean;
  comped: boolean;
  comped_until: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  admin_note: string | null;
}

interface Stats {
  mrrCents: number;
  byPlan: Record<string, number>;
  paying: number;
  pastDue: number;
  canceling: number;
  comped: number;
}

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 });
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const stripeTestMode = (id: string | null) => Boolean(id && /_test_/.test(id));

const EMPTY_PLAN: Plan = {
  slug: '',
  name: '',
  tagline: '',
  monthly_price_cents: 0,
  yearly_price_cents: 0,
  included_users: 1,
  extra_user_price_cents: 0,
  storage_gb: 10,
  protrades_limit: null,
  trial_days: 0,
  features: [],
  highlight: false,
  is_active: true,
  sort_order: 10,
  stripe_product_id: null,
  stripe_monthly_price_id: null,
  stripe_yearly_price_id: null,
};

const input = 'w-full rounded-lg border-2 border-black px-3 py-2 text-sm';
const label = 'mb-1 block text-xs font-semibold uppercase text-gray-600';

function PlanEditor({ plan, isNew, onClose, onSaved }: { plan: Plan; isNew: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const [draft, setDraft] = useState(plan);
  const [monthly, setMonthly] = useState((plan.monthly_price_cents / 100).toString());
  const [yearly, setYearly] = useState((plan.yearly_price_cents / 100).toString());
  const [extraUser, setExtraUser] = useState((plan.extra_user_price_cents / 100).toString());
  const [features, setFeatures] = useState(plan.features.join('\n'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toCents = (value: string) => Math.round((Number.parseFloat(value) || 0) * 100);
  const set = <K extends keyof Plan>(key: K, value: Plan[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/billing/plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: draft.slug,
          name: draft.name,
          tagline: draft.tagline,
          monthly_price_cents: toCents(monthly),
          yearly_price_cents: toCents(yearly),
          included_users: draft.included_users,
          extra_user_price_cents: toCents(extraUser),
          storage_gb: Number(draft.storage_gb),
          protrades_limit: draft.protrades_limit,
          trial_days: draft.trial_days,
          features: features.split('\n').map((line) => line.trim()).filter(Boolean),
          highlight: draft.highlight,
          is_active: draft.is_active,
          sort_order: draft.sort_order,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the plan');
      onSaved(data.stripeError ? `Saved. Stripe: ${data.stripeError}` : `Saved "${draft.name}" and synced Stripe prices.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'New plan' : `Edit ${plan.name}`} showHeader showCloseButton maxWidth="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Name</label>
            <input className={input} value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className={label}>Plan ID</label>
            <input
              className={`${input} disabled:bg-gray-100`}
              value={draft.slug}
              disabled={!isNew}
              placeholder="e.g. team"
              onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
          </div>
        </div>
        <div>
          <label className={label}>Tagline</label>
          <input className={input} value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Monthly price ($)</label>
            <input className={input} type="number" min="0" step="1" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </div>
          <div>
            <label className={label}>Yearly price ($)</label>
            <input className={input} type="number" min="0" step="1" value={yearly} onChange={(e) => setYearly(e.target.value)} />
            <button
              type="button"
              className="mt-1 cursor-pointer text-xs text-gray-600 underline"
              onClick={() => setYearly(String(Math.round((Number.parseFloat(monthly) || 0) * 10)))}
            >
              Set to 10 × monthly (2 months free)
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>Users included</label>
            <input
              className={input}
              type="number"
              min="1"
              placeholder="No limit"
              value={draft.included_users ?? ''}
              onChange={(e) => set('included_users', e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <label className={label}>Extra user ($/mo)</label>
            <input className={input} type="number" min="0" value={extraUser} onChange={(e) => setExtraUser(e.target.value)} />
          </div>
          <div>
            <label className={label}>Storage (GB)</label>
            <input className={input} type="number" min="0" step="0.5" value={draft.storage_gb} onChange={(e) => set('storage_gb', Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>ProTrades included</label>
            <input
              className={input}
              type="number"
              min="0"
              placeholder="All"
              value={draft.protrades_limit ?? ''}
              onChange={(e) => set('protrades_limit', e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <label className={label}>Free trial (days)</label>
            <input className={input} type="number" min="0" max="90" value={draft.trial_days} onChange={(e) => set('trial_days', Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Order</label>
            <input className={input} type="number" min="0" value={draft.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={label}>Features (one per line)</label>
          <textarea className={`${input} min-h-[110px]`} value={features} onChange={(e) => setFeatures(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={draft.highlight} onChange={(e) => set('highlight', e.target.checked)} />
            Highlight as most popular
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Show on the pricing page
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Saving creates or updates the Stripe product and prices. When a price changes, the old Stripe price is archived: current
          subscribers keep paying it until they change plans, and new subscribers pay the new one.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !draft.slug || !draft.name}>
            {saving ? 'Saving…' : 'Save and sync Stripe'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CompForm({ plans, target, onClose, onDone }: { plans: Plan[]; target: CompanySub | null; onClose: () => void; onDone: (message: string) => void }) {
  const [email, setEmail] = useState(target?.email ?? '');
  const [plan, setPlan] = useState(plans.find((p) => p.slug !== 'free')?.slug ?? 'free');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState(target?.admin_note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/billing/subscriptions', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comp',
          ...(target ? { userId: target.user_id } : { email }),
          plan,
          until: until ? new Date(`${until}T23:59:59`).toISOString() : null,
          note: note || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not give the plan');
      onDone('Plan given.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not give the plan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Give a plan for free" showHeader showCloseButton maxWidth="md">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">For partners, testers or promotions. No card needed and Stripe is not charged.</p>
        <div>
          <label className={label}>Account email</label>
          <input className={`${input} disabled:bg-gray-100`} type="email" value={email} disabled={Boolean(target)} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Plan</label>
            <select className={input} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Until (optional)</label>
            <input className={input} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={label}>Note</label>
          <input className={input} value={note} placeholder="e.g. Beta partner" onChange={(e) => setNote(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || (!target && !email)}>
            {busy ? 'Saving…' : 'Give plan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<'companies' | 'plans'>('companies');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<CompanySub[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ plan: Plan; isNew: boolean } | null>(null);
  const [comping, setComping] = useState<{ target: CompanySub | null } | null>(null);
  const [confirm, setConfirm] = useState<{ sub: CompanySub; action: 'cancel_at_period_end' | 'cancel_now' | 'uncomp' } | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paying' | 'comped' | 'past_due' | 'canceling' | 'free'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, subsRes] = await Promise.all([
        fetch('/api/admin/billing/plans', { credentials: 'include' }),
        fetch('/api/admin/billing/subscriptions', { credentials: 'include' }),
      ]);
      const plansData = await plansRes.json();
      const subsData = await subsRes.json();
      if (!plansRes.ok) throw new Error(plansData.error || 'Could not load plans');
      if (!subsRes.ok) throw new Error(subsData.error || 'Could not load subscriptions');
      setPlans(plansData.plans ?? []);
      setStripeConfigured(Boolean(plansData.stripeConfigured));
      setSubs(subsData.subscriptions ?? []);
      setStats(subsData.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const runAction = async (sub: CompanySub, action: string) => {
    setError(null);
    const res = await fetch('/api/admin/billing/subscriptions', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: sub.user_id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || 'Action failed');
    else setNotice('Done.');
    void load();
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter((sub) => {
      if (filter === 'paying' && !(sub.granted && !sub.comped)) return false;
      if (filter === 'comped' && !sub.comped) return false;
      if (filter === 'past_due' && sub.status !== 'past_due') return false;
      if (filter === 'canceling' && !sub.cancel_at_period_end) return false;
      if (filter === 'free' && sub.granted) return false;
      if (!q) return true;
      return [sub.email, sub.name, sub.company, sub.planName].some((value) => value?.toLowerCase().includes(q));
    });
  }, [subs, search, filter]);

  const stripeLink = (sub: CompanySub) =>
    sub.stripe_customer_id
      ? `https://dashboard.stripe.com/${stripeTestMode(sub.stripe_customer_id) ? 'test/' : ''}customers/${sub.stripe_customer_id}`
      : null;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-sm text-gray-600">Company plans, prices and who pays. Prices sync to Stripe when you save a plan.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setComping({ target: null })}>
            <Gift className="mr-2 h-4 w-4" />
            Give a plan
          </Button>
          <Button type="button" onClick={() => setEditing({ plan: EMPTY_PLAN, isNew: true })}>
            <Plus className="mr-2 h-4 w-4" />
            New plan
          </Button>
        </div>
      </div>

      {!stripeConfigured ? (
        <p className="rounded-lg border-2 border-amber-500 bg-amber-50 p-3 text-sm">STRIPE_SECRET_KEY is not set: plans save, but nobody can pay yet.</p>
      ) : null}
      {error ? <p className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg border-2 border-green-700 bg-green-50 p-3 text-sm text-green-800">{notice}</p> : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Monthly revenue', money(stats.mrrCents)],
            ['Paying companies', String(stats.paying)],
            ['Free (given)', String(stats.comped)],
            ['Past due', String(stats.pastDue)],
            ['Canceling', String(stats.canceling)],
          ].map(([title, value]) => (
            <div key={title} className="rounded-lg border-2 border-black p-3">
              <p className="text-xs font-semibold uppercase text-gray-500">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2 border-b-2 border-black">
        {(['companies', 'plans'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-0.5 cursor-pointer rounded-t-lg border-2 px-4 py-2 text-sm font-semibold ${
              tab === key ? 'border-black border-b-white bg-white' : 'border-transparent text-gray-600'
            }`}
          >
            {key === 'companies' ? `Companies (${subs.length})` : `Plans (${plans.length})`}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-gray-600">Loading…</p> : null}

      {tab === 'plans' && !loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.slug} className={`flex flex-col rounded-lg border-2 p-4 ${plan.highlight ? 'border-red-600' : 'border-black'} ${plan.is_active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1 text-lg font-bold">
                    {plan.name}
                    {plan.highlight ? <Star className="h-4 w-4 fill-red-600 text-red-600" /> : null}
                  </p>
                  <p className="text-xs text-gray-500">{plan.slug}{plan.is_active ? '' : ' · hidden'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing({ plan, isNew: false })}
                  className="cursor-pointer rounded-lg border-2 border-black p-1.5 hover:bg-gray-100"
                  aria-label={`Edit ${plan.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-2xl font-bold">
                {money(plan.monthly_price_cents)}
                <span className="text-sm font-normal text-gray-600">/mo</span>
              </p>
              <p className="text-xs text-gray-600">{plan.yearly_price_cents ? `${money(plan.yearly_price_cents)}/yr` : 'No yearly price'}</p>
              <ul className="mt-3 space-y-1 text-sm">
                <li>{plan.included_users ? `${plan.included_users} user${plan.included_users > 1 ? 's' : ''}` : 'Unlimited users'}{plan.extra_user_price_cents ? `, then ${money(plan.extra_user_price_cents)}/user` : ''}</li>
                <li>{Number(plan.storage_gb)} GB storage</li>
                <li>{plan.protrades_limit === null ? 'All ProTrades' : `${plan.protrades_limit} ProTrade${plan.protrades_limit === 1 ? '' : 's'}`}</li>
                {plan.trial_days ? <li>{plan.trial_days}-day free trial</li> : null}
              </ul>
              <div className="mt-auto pt-3 text-xs">
                <p className="font-semibold">Subscribers: {stats?.byPlan[plan.slug] ?? 0}</p>
                <p className={plan.stripe_monthly_price_id || plan.monthly_price_cents === 0 ? 'text-green-700' : 'text-amber-700'}>
                  {plan.monthly_price_cents === 0 && plan.yearly_price_cents === 0
                    ? 'Free plan: no Stripe price needed'
                    : plan.stripe_monthly_price_id || plan.stripe_yearly_price_id
                      ? 'Synced with Stripe'
                      : 'Not synced: edit and save to create Stripe prices'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'companies' && !loading ? (
        <div className="space-y-3">
          <TypingSearchInput value={search} onChange={setSearch} placeholder="Search by email, name, company or plan…" clearLabel="Clear search" />
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'All'],
                ['paying', 'Paying'],
                ['comped', 'Given free'],
                ['past_due', 'Past due'],
                ['canceling', 'Canceling'],
                ['free', 'Free / ended'],
              ] as const
            ).map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`cursor-pointer rounded-lg border-2 px-3 py-1 text-sm ${filter === key ? 'border-black bg-black text-white' : 'border-black bg-white'}`}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border-2 border-black">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Renews / ends</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                      No companies here yet.
                    </td>
                  </tr>
                ) : null}
                {visible.map((sub) => {
                  const link = stripeLink(sub);
                  return (
                    <tr key={sub.user_id} className="border-t border-gray-200 align-top">
                      <td className="px-3 py-2">
                        <p className="font-semibold">{sub.company || sub.name || '—'}</p>
                        <p className="text-xs text-gray-600">{sub.email ?? sub.user_id}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{sub.granted ? sub.planName : 'Free'}</p>
                        <p className="text-xs text-gray-600">
                          {sub.comped ? 'Given free' : sub.billing_interval === 'year' ? 'Yearly' : sub.billing_interval === 'month' ? 'Monthly' : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                            sub.status === 'past_due'
                              ? 'border-red-600 bg-red-50 text-red-700'
                              : sub.cancel_at_period_end
                                ? 'border-amber-600 bg-amber-50 text-amber-800'
                                : sub.granted
                                  ? 'border-green-700 bg-green-50 text-green-800'
                                  : 'border-gray-400 bg-gray-50 text-gray-700'
                          }`}
                        >
                          {sub.cancel_at_period_end ? 'Canceling' : sub.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{sub.comped ? (sub.comped_until ? `Free until ${date(sub.comped_until)}` : 'No end date') : date(sub.current_period_end)}</td>
                      <td className="max-w-[200px] px-3 py-2 text-xs text-gray-600">{sub.admin_note || ''}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border-2 border-black px-2 py-1 text-xs hover:bg-gray-100">
                              <ExternalLink className="h-3 w-3" />
                              Stripe
                            </a>
                          ) : null}
                          <button type="button" onClick={() => setComping({ target: sub })} className="cursor-pointer rounded-lg border-2 border-black px-2 py-1 text-xs hover:bg-gray-100">
                            Give plan
                          </button>
                          {sub.comped ? (
                            <button type="button" onClick={() => setConfirm({ sub, action: 'uncomp' })} className="cursor-pointer rounded-lg border-2 border-black px-2 py-1 text-xs hover:bg-gray-100">
                              End free plan
                            </button>
                          ) : null}
                          {sub.stripe_subscription_id && sub.granted && !sub.comped ? (
                            sub.cancel_at_period_end ? (
                              <button type="button" onClick={() => void runAction(sub, 'resume')} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-2 border-black px-2 py-1 text-xs hover:bg-gray-100">
                                <Check className="h-3 w-3" />
                                Resume
                              </button>
                            ) : (
                              <>
                                <button type="button" onClick={() => setConfirm({ sub, action: 'cancel_at_period_end' })} className="cursor-pointer rounded-lg border-2 border-black px-2 py-1 text-xs hover:bg-gray-100">
                                  Cancel at renewal
                                </button>
                                <button type="button" onClick={() => setConfirm({ sub, action: 'cancel_now' })} className="cursor-pointer rounded-lg border-2 border-red-600 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                                  Cancel now
                                </button>
                              </>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {editing ? (
        <PlanEditor
          plan={editing.plan}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            void load();
          }}
        />
      ) : null}
      {comping ? (
        <CompForm
          plans={plans}
          target={comping.target}
          onClose={() => setComping(null)}
          onDone={(message) => {
            setComping(null);
            setNotice(message);
            void load();
          }}
        />
      ) : null}
      <SimpleConfirmDialog
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const current = confirm;
          setConfirm(null);
          if (current) void runAction(current.sub, current.action);
        }}
        title={
          confirm?.action === 'cancel_now'
            ? `Cancel ${confirm.sub.company || confirm.sub.email} now? They lose the plan today and are not refunded.`
            : confirm?.action === 'uncomp'
              ? `End the free plan for ${confirm.sub.company || confirm.sub.email}?`
              : `Cancel ${confirm?.sub.company || confirm?.sub.email} at renewal? They keep the plan until ${date(confirm?.sub.current_period_end ?? null)}.`
        }
        confirmLabel={confirm?.action === 'uncomp' ? 'End free plan' : 'Cancel subscription'}
        cancelLabel="Keep"
      />
    </div>
  );
}
