'use client';

import { useState } from 'react';
import { Bot, Building2, CheckCircle2, Home, Shield, Sparkles, type LucideIcon } from 'lucide-react';
import Accordion from '@/components/ui/Accordion';

/**
 * Hub presentation: what customers, pros and the Hub admin can do today,
 * and what the AI will do for each of them (one person running a whole company).
 * Content only. Edit the lists below to update the page.
 */

type Group = { title: string; items: string[] };
type Audience = {
  id: 'customers' | 'pros' | 'admin';
  label: string;
  icon: LucideIcon;
  pitch: string;
  today: Group[];
  ai: Group[];
};

const AUDIENCES: Audience[] = [
  {
    id: 'customers',
    label: 'Customers',
    icon: Home,
    pitch: 'One place for the whole house: find a trusted pro, book, approve, pay, and keep every record of the home.',
    today: [
      {
        title: 'Find and choose pros',
        items: [
          'Pro directory with card, list and map views, search by trade and category',
          'Pro business card, profile, services and reviews; leave feedback',
          'Save favorite pros',
          'Installers, handymen, suppliers (ProSuppliers) and ProProducts',
          'ProJobs and ProResume',
          'Quick Repair request',
          'Scan a pro QR code to open their card',
          'Blog, help and legal pages',
        ],
      },
      {
        title: 'My Places (their homes)',
        items: [
          'Add and manage properties',
          'Every pro on a property: trade, contact, work counts, open balance',
          'Filter a property to one pro’s work',
          'Share a property with a pro',
          'Property timeline of everything that happened',
          'Tabs: Projects, Maintenance, Appointments, Documents, Invoices, Estimates',
          'Accept a pro’s invite and pick the place their work is for',
        ],
      },
      {
        title: 'Booking and appointments',
        items: [
          'Book a pro from their public booking page',
          'View, reschedule or cancel appointments (also from a link, no sign-in)',
          'Automatic booking reminders',
        ],
      },
      {
        title: 'Estimates, invoices and payments',
        items: [
          'Request an estimate',
          'View an estimate from a link and approve or decline it',
          'View an invoice and pay by card (Stripe), also on the pro’s device',
          'Scan the QR code on a printed invoice to pay',
          'Invoice PDF and payment history',
        ],
      },
      {
        title: 'Communication and account',
        items: [
          'Chat with pros in ProBot (also as a visitor)',
          'Presence, unread counts and notifications',
          'AI assistant (ProBot)',
          'Sign up, Google sign-in, two-step login, password reset, profile',
          'Feed and map view',
        ],
      },
    ],
    ai: [
      {
        title: 'Home assistant',
        items: [
          'Answers questions about the house any time: “When was my AC serviced?”, “What did I pay for the pavers?”',
          'Reminds them of seasonal maintenance and books it with their pro in one tap',
          'Spots problems from a photo and suggests the right trade',
        ],
      },
      {
        title: 'Hands-free booking',
        items: [
          'Call or text the pro’s AI receptionist any hour and get booked on the spot',
          'Day-before confirmation call or text, and an “on my way” message',
          'Reschedules around weather automatically',
        ],
      },
      {
        title: 'Clear money, no surprises',
        items: [
          'Explains each estimate in plain words and compares options',
          'Friendly payment reminders and payment plans when needed',
          'One home budget: what was spent, what is coming',
        ],
      },
      {
        title: 'Feeling cared for',
        items: [
          'Thank-you message with before/after photos when a job is done',
          'A personal call or message on their birthday and home anniversary',
          '30-day check-in: “Is everything still working well?”',
        ],
      },
    ],
  },
  {
    id: 'pros',
    label: 'Pros',
    icon: Building2,
    pitch: 'ProsCRM runs the business end to end, and the AI does the work of a full office staff.',
    today: [
      {
        title: 'Business presence',
        items: [
          'Business card and profile: logo, trades, licenses, services, links, online status',
          'Public booking page and QR code',
          'Subscription and billing',
          'Crew invites, roles, partners, multiple businesses',
        ],
      },
      {
        title: 'Customers and sales',
        items: [
          'Contacts with roles (customer, supplier, subcontractor, employee, project manager)',
          'Card, list, table, map and chart views; statements; open balances',
          'Next steps for new contacts',
          'Lead referrals, lead offers and lead expiry',
          'Estimates with discounts, Approved status, tablet signing, convert to invoice or project',
        ],
      },
      {
        title: 'Invoicing and payments',
        items: [
          'New, edit and recurring invoices',
          'Invoice branding: logo, colors, company display names',
          'Send by email, payment link with QR code, collect card on device',
          'Record and void payments, ledger and events, attachments',
          'PDF and print, card / list / table / map / chart views',
        ],
      },
      {
        title: 'Jobs and operations',
        items: [
          'Projects with photos per address',
          'Maintenance houses, plans, visits and next-visit schedule',
          'Calendar and appointments',
          'Items, products and services catalog',
          'Jobsite camera (beta)',
          'ProTrades: Landscape, Hardscape and the rock yard',
          'ProTools inventory, ProDrive file storage, QR codes',
        ],
      },
      {
        title: 'Money and reports',
        items: ['Expenses and printable expense list', 'Mileage', 'Dashboard and reports'],
      },
      {
        title: 'Communication and automation',
        items: [
          'ProBot chat with customers and contacts, place sharing, invoice cards in chat',
          'Customer portal',
          'MCP server, llms.txt and OpenAPI so outside AIs can work with the Hub',
          'Scheduled jobs: reminders, books, lead expiry, usage reports',
        ],
      },
    ],
    ai: [
      {
        title: 'AI receptionist and phone',
        items: [
          'Answers every call 24/7, qualifies the lead, books the visit, creates the contact',
          'Calls to confirm appointments and follow up on estimates',
          'Polite overdue-invoice calls',
          'Birthday call to each customer with a warm personal message',
        ],
      },
      {
        title: 'AI office: email and text',
        items: [
          'Writes every message in the pro’s own voice',
          'Lifecycle autopilot: welcome → estimate → reminder → job day → thank-you → review request → check-in → seasonal offer',
          'Holiday and home-anniversary messages',
          'Review and referral requests at the right moment',
        ],
      },
      {
        title: 'AI estimator',
        items: [
          'Builds an estimate from photos, a voice note or a site walk',
          'Prices from the pro’s catalog and past jobs',
          'Suggests good / better / best options',
        ],
      },
      {
        title: 'AI scheduler and dispatcher',
        items: [
          'Fills the calendar and plans the route between jobs',
          'Reschedules around weather and delays, tells the customer',
          'Daily crew briefs and job assignments',
        ],
      },
      {
        title: 'AI bookkeeper and collections',
        items: [
          'Sorts expenses from receipt photos, logs mileage automatically',
          'Books ready for QuickBooks and tax time',
          'Collections step by step: reminder → call → payment plan',
          'Weekly profit report',
        ],
      },
      {
        title: 'AI marketing and purchasing',
        items: [
          'Social posts and blog posts from job photos',
          'Offers to past customers, replies to reviews',
          'Orders materials from suppliers when a project is approved, tracks delivery',
        ],
      },
      {
        title: 'The owner stays in control',
        items: [
          'Morning brief: today’s jobs, money in and owed, new leads, decisions needed',
          'For each AI job choose: do it / ask me first / never',
          'Full log of everything the AI did and said',
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Hub admin',
    icon: Shield,
    pitch: 'Run the whole marketplace: users, pros, quality, content and growth, with AI watching every corner.',
    today: [
      {
        title: 'People and businesses',
        items: [
          'Users, customers and businesses',
          'Delete business, clear data',
          'Invitation codes and subscriptions',
          'Suppliers and products',
        ],
      },
      {
        title: 'Leads and quality',
        items: [
          'Estimate requests with assignment to pros (lead routing)',
          'ProBot chat oversight',
          'Plant ID training corrections',
          'License categories',
        ],
      },
      {
        title: 'Content and platform',
        items: [
          'Blog',
          'QR codes, icons, main menu',
          'ProTrades databases',
          'Agent apps (MCP / outside AI access)',
          'Storage buckets',
        ],
      },
    ],
    ai: [
      {
        title: 'AI lead router',
        items: [
          'Sends each new request to the best pro: trade, distance, rating, speed, availability',
          'Re-routes leads that expire and tells the customer',
          'Spots lost leads and suggests follow-ups',
        ],
      },
      {
        title: 'AI trust and safety',
        items: [
          'Checks licenses and insurance and flags expired ones',
          'Finds fake reviews, spam and fraud',
          'Reviews chats for abuse and escalates',
        ],
      },
      {
        title: 'AI growth team',
        items: [
          'Finds and invites new pros in areas with too few',
          'Onboards pros: builds their card, catalog and booking page from their website',
          'Writes SEO blog posts and local pages',
          'Win-back messages to inactive pros and customers',
        ],
      },
      {
        title: 'AI support desk',
        items: [
          'Answers pro and customer support chats and calls',
          'Walks pros through features step by step',
          'Hands hard cases to the admin with a summary',
        ],
      },
      {
        title: 'AI operations brief',
        items: [
          'Daily Hub report: sign-ups, leads, bookings, payments, churn',
          'Alerts on errors, payment failures and slow pages',
          'Revenue forecast and subscription health',
        ],
      },
    ],
  },
];

const ROADMAP = [
  { step: 1, title: 'AI email and text writer + lifecycle autopilot', why: 'Uses data the Hub already has. Fastest win for every pro.' },
  { step: 2, title: 'AI phone receptionist', why: 'Biggest money maker: no missed call becomes a lost job.' },
  { step: 3, title: 'Owner morning brief and approval controls', why: 'Keeps the pro in charge and ties every AI job together.' },
  { step: 4, title: 'AI estimator and scheduler', why: 'Saves hours each week on quoting and planning.' },
  { step: 5, title: 'AI bookkeeper, collections and marketing', why: 'Closes the loop from first call to the last thank-you.' },
  { step: 6, title: 'Admin AI: lead router, trust and safety, growth', why: 'Lets one admin run the whole marketplace.' },
];

function GroupList({ groups, ai }: { groups: Group[]; ai: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map((group) => (
        <div key={group.title} className="rounded-lg border-2 border-black p-3">
          <h4 className="mb-2 font-semibold">{group.title}</h4>
          <ul className="space-y-1.5 text-sm text-gray-800">
            {group.items.map((item) => (
              <li key={item} className="flex gap-2">
                {ai ? (
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                )}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AdminPresentationPage() {
  const [audienceId, setAudienceId] = useState<Audience['id']>('customers');
  const [open, setOpen] = useState<{ today: boolean; ai: boolean; roadmap: boolean }>({ today: true, ai: true, roadmap: true });
  const audience = AUDIENCES.find((entry) => entry.id === audienceId) ?? AUDIENCES[0];
  const todayCount = audience.today.reduce((sum, group) => sum + group.items.length, 0);
  const aiCount = audience.ai.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-2 md:p-6">
      <header className="rounded-lg bg-black p-5 text-white md:p-8">
        <p className="flex items-center gap-2 text-sm font-medium text-red-400">
          <Bot className="h-4 w-4" /> House Pros Hub
        </p>
        <h1 className="mt-2 text-2xl font-bold md:text-4xl">One person. A whole company. Run by AI.</h1>
        <p className="mt-3 max-w-3xl text-sm text-gray-300 md:text-base">
          From answering the first phone call to sending the last thank-you email, and calling the customer on their
          birthday, the Hub’s AI does the office work so one pro can run the entire business.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Audience">
        {AUDIENCES.map((entry) => {
          const Icon = entry.icon;
          const active = entry.id === audienceId;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setAudienceId(entry.id)}
              className={`inline-flex h-11 items-center gap-2 rounded-lg border-2 border-black px-4 text-sm font-medium cursor-pointer ${
                active ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-red-500'}`} />
              {entry.label}
            </button>
          );
        })}
      </div>

      <p className="text-base text-gray-800">{audience.pitch}</p>

      <Accordion
        title={`What ${audience.label.toLowerCase()} can do today · ${todayCount}`}
        subtitle="Live in the Hub now"
        icon={<CheckCircle2 className="h-5 w-5" />}
        isOpen={open.today}
        onToggle={() => setOpen((prev) => ({ ...prev, today: !prev.today }))}
      >
        <GroupList groups={audience.today} ai={false} />
      </Accordion>

      <Accordion
        title={`What AI will do for ${audience.label.toLowerCase()} · ${aiCount}`}
        subtitle="Coming next"
        icon={<Sparkles className="h-5 w-5" />}
        isOpen={open.ai}
        onToggle={() => setOpen((prev) => ({ ...prev, ai: !prev.ai }))}
      >
        <GroupList groups={audience.ai} ai />
      </Accordion>

      <Accordion
        title="Build order"
        subtitle="What we build first and why"
        icon={<Bot className="h-5 w-5" />}
        isOpen={open.roadmap}
        onToggle={() => setOpen((prev) => ({ ...prev, roadmap: !prev.roadmap }))}
      >
        <ol className="space-y-2">
          {ROADMAP.map((entry) => (
            <li key={entry.step} className="flex items-start gap-3 rounded-lg border-2 border-black p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black text-sm font-bold text-white">
                {entry.step}
              </span>
              <div>
                <p className="font-semibold">{entry.title}</p>
                <p className="text-sm text-gray-700">{entry.why}</p>
              </div>
            </li>
          ))}
        </ol>
      </Accordion>
    </div>
  );
}
