'use client';

import Link from 'next/link';
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Hammer,
  Home,
  Paperclip,
  Receipt,
  Banknote,
  Trophy,
  UserCheck,
  Wrench,
  XCircle,
  type LucideIcon,
  BellRing,
} from 'lucide-react';
import type { TimelineStep, TimelineStepKind } from '@/lib/timeline/steps';

const STEP_ICON: Record<TimelineStepKind, LucideIcon> = {
  estimate: FileText,
  approved: CheckCircle2,
  declined: XCircle,
  invoice: Receipt,
  reminder: BellRing,
  viewed: Eye,
  payment: Banknote,
  paid: BadgeCheck,
  project: Hammer,
  project_done: Trophy,
  maintenance: CalendarClock,
  visit: Wrench,
  document: Paperclip,
  pro: UserCheck,
  appointment: CalendarDays,
  place: Home,
};

/** Steps that close a stage stand out in green; a declined estimate in red. */
const STEP_TONE: Partial<Record<TimelineStepKind, string>> = {
  approved: 'border-green-700 bg-green-50 text-green-800',
  paid: 'border-green-700 bg-green-50 text-green-800',
  payment: 'border-green-700 bg-green-50 text-green-800',
  project_done: 'border-green-700 bg-green-50 text-green-800',
  declined: 'border-red-700 bg-red-50 text-red-700',
};

const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function when(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface TimelineStepsProps {
  steps: TimelineStep[];
  emptyText: string;
  /** Pro side: tag each step with whether the homeowner sees it. */
  showAudience?: boolean;
  /** Line before the pro name ("with"), homeowner side. */
  formatWhen?: (value: string) => string;
  /** Steps the viewer has not seen yet get a red New tag. */
  newIds?: ReadonlySet<string>;
}

/**
 * A property's timeline as connected steps, newest first. Used on the homeowner's My Places page
 * and the pro's Customer portal so both read the job the same way.
 */
export function TimelineSteps({ steps, emptyText, showAudience = false, formatWhen = when, newIds }: TimelineStepsProps) {
  if (steps.length === 0) return <p className="text-sm text-gray-600">{emptyText}</p>;
  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const Icon = STEP_ICON[step.kind];
        const last = index === steps.length - 1;
        const body = (
          <div className="min-w-0 flex-1 pb-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-sm text-gray-900">
                {newIds?.has(step.id) ? (
                  <span className="mr-1.5 inline-block rounded-md bg-red-600 px-1.5 align-middle text-[10px] font-bold uppercase text-white">New</span>
                ) : null}
                {step.title}
              </p>
              <time className="shrink-0 whitespace-nowrap text-xs text-gray-500" dateTime={step.at}>
                {formatWhen(step.at)}
              </time>
            </div>
            <p className="text-xs text-gray-600">
              {step.detail}
              {step.detail && typeof step.amountCents === 'number' ? ' · ' : null}
              {typeof step.amountCents === 'number' ? money(step.amountCents) : null}
            </p>
            {showAudience && step.customerSees !== undefined ? (
              <p className={`mt-1 inline-flex items-center gap-1 text-[11px] ${step.customerSees ? 'text-gray-600' : 'text-amber-800'}`}>
                {step.customerSees ? <Eye className="h-3 w-3" aria-hidden /> : <EyeOff className="h-3 w-3" aria-hidden />}
                {step.customerSees ? 'Customer sees this' : 'Only you see this'}
              </p>
            ) : null}
          </div>
        );
        return (
          <li key={step.id} className="relative flex gap-3">
            {!last ? <span className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-gray-300" aria-hidden /> : null}
            <span
              className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${STEP_TONE[step.kind] ?? 'border-black bg-white text-black'}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            {step.href ? (
              <Link href={step.href} className="min-w-0 flex-1 rounded-md hover:bg-gray-50">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
