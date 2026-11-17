import { createServiceRoleClient } from '@/lib/supabase/server';
import { listPortalPlaces, loadPlaceBundle, type PlaceBundle } from '@/lib/places/portal';
import { siteOrigin } from '@/lib/agent/constants';
import type { OpenAiTool } from '@/lib/agent/tools';
import type { ChatCrmEstimateShare } from '@/lib/types/chat';

/**
 * Tools for a signed-in homeowner's own places (My Places).
 * They only run inside the hub chat with a session user id. They are never offered
 * to MCP/REST apps, which act for a third-party app, not for a homeowner.
 */
export const PLACE_TOOL_NAMES = [
  'get_my_places',
  'get_place_details',
  'get_place_timeline',
  'search_my_places',
  'approve_estimate',
] as const;

export type PlaceToolName = (typeof PLACE_TOOL_NAMES)[number];

export function isPlaceTool(name: string): name is PlaceToolName {
  return (PLACE_TOOL_NAMES as readonly string[]).includes(name);
}

export function placeOpenAiTools(): OpenAiTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_my_places',
        description:
          'List the signed-in homeowner\'s places (houses, businesses, buildings) with ids. Call this first when you need a placeId.',
        parameters: { type: 'object', additionalProperties: false, properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_place_details',
        description:
          'Read one place: projects and phases, maintenance plans, estimates, invoices with balances, document titles, and appointments. Use ids from get_my_places.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['placeId'],
          properties: { placeId: { type: 'string' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_place_timeline',
        description: 'Read the history of one place, newest first: estimates received or approved, invoices, payments, documents, visits.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['placeId'],
          properties: {
            placeId: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 40 },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_my_places',
        description:
          'Search everything on the homeowner\'s places by keywords, such as "pavers deposit" or "irrigation visit". Returns the best matching records with their place.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['query'],
          properties: { query: { type: 'string' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'approve_estimate',
        description:
          'Show a sent estimate as an approval card. This does NOT approve it. The homeowner signs their name and taps Approve on the card. Use only when the homeowner asks to approve or accept a specific estimate. Use the estimate id from get_place_details.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['estimateId'],
          properties: { estimateId: { type: 'string' } },
        },
      },
    },
  ];
}

export interface PlaceToolContext {
  userId: string;
  locale: string;
}

export interface PlaceToolResult {
  data: unknown;
  isError: boolean;
  /** Approval card for the chat message. Only approve_estimate sets this. */
  crmEstimate?: ChatCrmEstimateShare;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PLACES_SCANNED = 6;

/** Same format as the portal brief, so the price guard can match the figure. */
function usd(cents: number | null | undefined): string | null {
  if (typeof cents !== 'number') return null;
  return `${(cents / 100).toFixed(2)} USD`;
}

async function userEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await createServiceRoleClient().auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

function presentBundle(bundle: PlaceBundle) {
  return {
    place: {
      id: bundle.place.id,
      kind: bundle.place.kind,
      name: bundle.place.name,
      address: [bundle.place.street, bundle.place.city, bundle.place.state].filter(Boolean).join(', ') || null,
    },
    projects: bundle.projects.map((project) => ({
      name: project.name,
      status: project.status,
      pro: project.proName,
      start: project.startDate,
      end: project.endDate,
      phases: project.phases.map((phase) => ({
        name: phase.name,
        status: phase.status,
        start: phase.startDate,
        end: phase.endDate,
      })),
    })),
    maintenance: bundle.maintenance.map((plan) => ({
      name: plan.name,
      pro: plan.proName,
      frequency: plan.frequency,
      nextVisit: plan.nextVisit,
      lastVisit: plan.lastVisit,
      amount: usd(plan.amountCents),
    })),
    estimates: bundle.estimates.map((estimate) => ({
      id: estimate.id,
      number: estimate.number,
      status: estimate.status,
      pro: estimate.proName,
      jobArea: estimate.jobArea,
      amount: usd(estimate.amountCents),
      deposit: usd(estimate.depositCents),
      validUntil: estimate.dueDate,
      signedAt: estimate.signedAt,
      canApproveInChat: estimate.status === 'sent',
    })),
    invoices: bundle.invoices.map((invoice) => ({
      number: invoice.number,
      status: invoice.status,
      pro: invoice.proName,
      amount: usd(invoice.amountCents),
      balance: usd(Math.max(0, invoice.amountCents - invoice.appliedCents)),
      due: invoice.dueDate,
    })),
    documents: bundle.documents.map((doc) => ({
      title: doc.title,
      kind: doc.kind,
      pro: doc.proName,
      receivedAt: doc.receivedAt,
    })),
    appointments: bundle.appointments.map((visit) => ({
      pro: visit.proName,
      status: visit.status,
      startAt: visit.startAt,
      service: visit.serviceName ?? null,
    })),
    note: 'Files open on My Places. Read figures exactly as written here.',
  };
}

interface SearchChunk {
  placeId: string;
  placeName: string;
  kind: string;
  text: string;
  date: string | null;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'my', 'me', 'is', 'was', 'what', 'when', 'did',
  'do', 'does', 'how', 'much', 'i', 'it', 'at', 'with', 'about', 'de', 'la', 'el', 'o', 'e', 'do', 'da', 'que',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

function chunksFromBundle(bundle: PlaceBundle): SearchChunk[] {
  const base = { placeId: bundle.place.id, placeName: bundle.place.name };
  const chunks: SearchChunk[] = [];
  for (const event of bundle.timeline) {
    chunks.push({
      ...base,
      kind: `timeline:${event.kind}`,
      text: [event.title, event.detail, event.proName, event.jobArea, usd(event.amountCents)].filter(Boolean).join(' · '),
      date: event.occurredAt,
    });
  }
  for (const project of bundle.projects) {
    chunks.push({
      ...base,
      kind: 'project',
      text: [`Project ${project.name}`, project.status, project.proName, ...project.phases.map((p) => `${p.name} ${p.status}`)].join(' · '),
      date: project.startDate,
    });
  }
  for (const plan of bundle.maintenance) {
    chunks.push({
      ...base,
      kind: 'maintenance',
      text: [`Maintenance ${plan.name}`, plan.summary, plan.frequency, plan.proName, `next visit ${plan.nextVisit ?? 'not set'}`, usd(plan.amountCents)]
        .filter(Boolean)
        .join(' · '),
      date: plan.nextVisit,
    });
  }
  for (const estimate of bundle.estimates) {
    chunks.push({
      ...base,
      kind: 'estimate',
      text: [`Estimate ${estimate.number}`, estimate.status, estimate.proName, estimate.jobArea, usd(estimate.amountCents), `deposit ${usd(estimate.depositCents)}`]
        .filter(Boolean)
        .join(' · '),
      date: estimate.receivedAt,
    });
  }
  for (const invoice of bundle.invoices) {
    chunks.push({
      ...base,
      kind: 'invoice',
      text: [`Invoice ${invoice.number}`, invoice.status, invoice.proName, usd(invoice.amountCents), `balance ${usd(Math.max(0, invoice.amountCents - invoice.appliedCents))}`, `due ${invoice.dueDate ?? 'not set'}`]
        .join(' · '),
      date: invoice.invoiceDate,
    });
  }
  for (const doc of bundle.documents) {
    chunks.push({ ...base, kind: 'document', text: [`Document ${doc.title}`, doc.kind, doc.proName].join(' · '), date: doc.receivedAt });
  }
  for (const visit of bundle.appointments) {
    chunks.push({
      ...base,
      kind: 'appointment',
      text: [`Appointment with ${visit.proName}`, visit.status, visit.serviceName].filter(Boolean).join(' · '),
      date: visit.startAt,
    });
  }
  return chunks;
}

/** Keyword retrieval over the homeowner's own records. Exported for tests. */
export function rankChunks(query: string, chunks: SearchChunk[], limit = 8): SearchChunk[] {
  const wanted = tokens(query);
  if (wanted.length === 0) return [];
  const scored = chunks
    .map((chunk) => {
      const have = new Set(tokens(`${chunk.kind} ${chunk.text} ${chunk.placeName}`));
      let score = 0;
      for (const word of wanted) {
        if (have.has(word)) score += 2;
        else if ([...have].some((token) => token.startsWith(word) || word.startsWith(token))) score += 1;
      }
      return { chunk, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.chunk.date ?? '').localeCompare(a.chunk.date ?? ''));
  return scored.slice(0, limit).map((row) => row.chunk);
}

async function ownedPlaceBundle(ctx: PlaceToolContext, placeId: string, email: string | null) {
  if (!UUID_RE.test(placeId)) return null;
  return loadPlaceBundle(ctx.userId, placeId, email);
}

async function buildApprovalCard(ctx: PlaceToolContext, estimateId: string): Promise<PlaceToolResult> {
  if (!UUID_RE.test(estimateId)) return { data: { error: 'Unknown estimate id. Use get_place_details first.' }, isError: true };
  const admin = createServiceRoleClient();
  const { data: estimate } = await admin
    .from('pro_crm_estimates')
    .select('id, customer_id, owner_id, status, display_id, amount_cents, deposit_cents, due_date, line_items, job_area')
    .eq('id', estimateId)
    .maybeSingle();
  if (!estimate) return { data: { error: 'Estimate not found on your places.' }, isError: true };

  // Same ownership rule as /api/places/[id]/estimates/[estimateId]/approve.
  const { data: customer } = await admin
    .from('pro_crm_customers')
    .select('id, place_id')
    .eq('id', estimate.customer_id)
    .eq('portal_user_id', ctx.userId)
    .maybeSingle();
  if (!customer?.place_id) return { data: { error: 'Estimate not found on your places.' }, isError: true };

  if (estimate.status === 'accepted') {
    return { data: { status: 'already_approved', number: estimate.display_id }, isError: false };
  }
  if (estimate.status !== 'sent') {
    return { data: { error: `This estimate is ${estimate.status}. Only a sent estimate can be approved.` }, isError: true };
  }

  const { data: tokenRow, error: tokenError } = await admin
    .from('pro_estimate_view_tokens')
    .insert({
      estimate_id: estimate.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('token')
    .single();
  if (tokenError || !tokenRow) return { data: { error: 'Could not open the estimate right now.' }, isError: true };

  const { data: biz } = await admin
    .from('businesses')
    .select('business_name, business_logo')
    .eq('owner_id', estimate.owner_id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const lineItems = Array.isArray(estimate.line_items) ? estimate.line_items : [];
  const lineItemsPreview = lineItems
    .flatMap((line) => {
      if (!line || typeof line !== 'object' || Array.isArray(line)) return [];
      const row = line as Record<string, unknown>;
      return [
        {
          product_or_service: typeof row.product_or_service === 'string' ? row.product_or_service : null,
          description: typeof row.description === 'string' ? row.description : null,
          amount_cents: typeof row.amount_cents === 'number' ? row.amount_cents : null,
        },
      ];
    })
    .slice(0, 4);

  const token = tokenRow.token as string;
  const number = String(estimate.display_id ?? estimate.id.slice(0, 8));
  const card: ChatCrmEstimateShare = {
    token,
    estimateId: estimate.id,
    estimateNumber: number,
    amountCents: estimate.amount_cents ?? 0,
    depositCents: estimate.deposit_cents ?? 0,
    status: 'sent',
    validUntilDate: estimate.due_date,
    businessName: biz?.business_name ?? null,
    businessLogo: biz?.business_logo ?? null,
    viewUrl: `${siteOrigin()}/${ctx.locale}/estimates/view?token=${token}`,
    lineItemsPreview,
  };

  return {
    data: {
      shown: true,
      number,
      amount: usd(card.amountCents),
      deposit: usd(card.depositCents),
      pro: card.businessName,
      next: 'The approval card is on screen. Tell the homeowner to review it, type their name, and tap Approve. You did not approve anything.',
    },
    isError: false,
    crmEstimate: card,
  };
}

export async function runPlaceTool(
  name: string,
  args: Record<string, unknown>,
  ctx: PlaceToolContext
): Promise<PlaceToolResult | null> {
  if (!isPlaceTool(name)) return null;

  if (name === 'get_my_places') {
    const places = await listPortalPlaces(ctx.userId);
    return {
      data: {
        places: places.map((place) => ({
          id: place.id,
          kind: place.kind,
          name: place.name,
          address: [place.street, place.city, place.state].filter(Boolean).join(', ') || null,
          projects: place.projectCount,
          maintenancePlans: place.maintenanceCount,
        })),
      },
      isError: false,
    };
  }

  if (name === 'approve_estimate') {
    const estimateId = typeof args.estimateId === 'string' ? args.estimateId.trim() : '';
    return buildApprovalCard(ctx, estimateId);
  }

  const email = await userEmail(ctx.userId);

  if (name === 'get_place_details' || name === 'get_place_timeline') {
    const placeId = typeof args.placeId === 'string' ? args.placeId.trim() : '';
    const bundle = await ownedPlaceBundle(ctx, placeId, email);
    if (!bundle) return { data: { error: 'Place not found. Call get_my_places for valid ids.' }, isError: true };
    if (name === 'get_place_details') return { data: presentBundle(bundle), isError: false };
    const limit = typeof args.limit === 'number' ? Math.min(40, Math.max(1, Math.floor(args.limit))) : 15;
    return {
      data: {
        place: bundle.place.name,
        events: bundle.timeline.slice(0, limit).map((event) => ({
          when: event.occurredAt,
          kind: event.kind,
          title: event.title,
          detail: event.detail,
          pro: event.proName,
          jobArea: event.jobArea,
          amount: usd(event.amountCents),
        })),
      },
      isError: false,
    };
  }

  // search_my_places
  const query = typeof args.query === 'string' ? args.query.trim().slice(0, 200) : '';
  if (!query) return { data: { error: 'query is required' }, isError: true };
  const places = (await listPortalPlaces(ctx.userId)).slice(0, MAX_PLACES_SCANNED);
  const bundles = await Promise.all(places.map((place) => loadPlaceBundle(ctx.userId, place.id, email)));
  const chunks = bundles.flatMap((bundle) => (bundle ? chunksFromBundle(bundle) : []));
  const matches = rankChunks(query, chunks);
  return {
    data: {
      query,
      matches: matches.map((chunk) => ({
        placeId: chunk.placeId,
        place: chunk.placeName,
        kind: chunk.kind,
        record: chunk.text,
        date: chunk.date,
      })),
      note: matches.length ? undefined : 'Nothing on their places matches. Say so; do not guess.',
    },
    isError: false,
  };
}
