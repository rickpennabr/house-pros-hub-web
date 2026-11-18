import type { AgentPro } from '@/lib/agent/present';
import type { ProAgentEstimateSummary, ProAgentPayload, ProAgentProCard } from '@/lib/types/chat';

export const PROAGENT_WRITE_TOOL = 'create_estimate';

export function toolNeedsHomeownerConfirm(name: string): boolean {
  return name === PROAGENT_WRITE_TOOL;
}

/** Fill only the empty description. Every other field has to come from the homeowner. */
export function normalizeEstimateArgs(raw: Record<string, unknown>): Record<string, unknown> {
  const next = { ...raw };
  if (typeof next.state === 'string') next.state = next.state.trim().toUpperCase();
  if (next.projectDescription == null) next.projectDescription = '';
  return next;
}

export function publicProCard(pro: AgentPro, locale: string): ProAgentProCard {
  const safeLocale = locale === 'es' || locale === 'pt' ? locale : 'en';
  return {
    id: pro.id,
    name: pro.name,
    category: pro.category,
    city: pro.city,
    state: pro.state,
    profileUrl: pro.profileUrl.replace('/en/business/', `/${safeLocale}/business/`),
  };
}

export function estimateSummary(data: Record<string, unknown>): ProAgentEstimateSummary {
  const trades = Array.isArray(data.trades) ? data.trades.filter((item): item is string => typeof item === 'string') : [];
  return {
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    streetAddress: typeof data.streetAddress === 'string' ? data.streetAddress : '',
    city: typeof data.city === 'string' ? data.city : '',
    state: typeof data.state === 'string' ? data.state : '',
    trades,
    budgetRange: typeof data.budgetRange === 'string' ? data.budgetRange : '',
    timeline: typeof data.timeline === 'string' ? data.timeline : '',
    projectType: typeof data.projectType === 'string' ? data.projectType : '',
  };
}

export function directoryToolInput(name: string, args: Record<string, unknown>): Record<string, unknown> {
  if (name === 'search_pros') {
    return {
      search: typeof args.search === 'string' ? args.search : '',
      category: typeof args.category === 'string' ? args.category : '',
      city: typeof args.city === 'string' ? args.city : '',
    };
  }
  if (name === 'get_pro') return { id: typeof args.id === 'string' ? args.id : '' };
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asProCard(value: unknown): ProAgentProCard | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.profileUrl !== 'string') return null;
  return {
    id: row.id,
    name: row.name,
    category: typeof row.category === 'string' ? row.category : null,
    city: typeof row.city === 'string' ? row.city : null,
    state: typeof row.state === 'string' ? row.state : null,
    profileUrl: row.profileUrl,
  };
}

function asSummary(value: unknown): ProAgentEstimateSummary | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.firstName !== 'string' || typeof row.city !== 'string') return null;
  return {
    firstName: row.firstName,
    lastName: typeof row.lastName === 'string' ? row.lastName : '',
    streetAddress: typeof row.streetAddress === 'string' ? row.streetAddress : '',
    city: row.city,
    state: typeof row.state === 'string' ? row.state : '',
    trades: asStringArray(row.trades),
    budgetRange: typeof row.budgetRange === 'string' ? row.budgetRange : '',
    timeline: typeof row.timeline === 'string' ? row.timeline : '',
    projectType: typeof row.projectType === 'string' ? row.projectType : '',
  };
}

function asDocPlace(value: unknown): { id: string; name: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id) return null;
  return { id: row.id, name: typeof row.name === 'string' ? row.name : '' };
}

function asCrmInvoice(value: unknown): ProAgentPayload['crmInvoice'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.token !== 'string' || !row.token || typeof row.invoiceId !== 'string') return null;
  return {
    token: row.token,
    invoiceId: row.invoiceId,
    invoiceNumber: typeof row.invoiceNumber === 'string' ? row.invoiceNumber : row.invoiceId.slice(0, 8),
    amountCents: typeof row.amountCents === 'number' ? row.amountCents : 0,
    dueDate: typeof row.dueDate === 'string' ? row.dueDate : null,
    kind: row.kind === 'payment' ? 'payment' : 'invoice',
    place: asDocPlace(row.place),
  };
}

function asCrmEstimate(value: unknown): ProAgentPayload['crmEstimate'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.token !== 'string' || !row.token.trim()) return null;
  if (typeof row.estimateId !== 'string' || !row.estimateId.trim()) return null;
  if (typeof row.viewUrl !== 'string' || !row.viewUrl.trim()) return null;
  const status =
    row.status === 'draft' || row.status === 'sent' || row.status === 'accepted' || row.status === 'declined'
      ? row.status
      : 'sent';
  const lineItemsPreview = Array.isArray(row.lineItemsPreview)
    ? row.lineItemsPreview
        .filter((line): line is Record<string, unknown> => Boolean(line) && typeof line === 'object')
        .slice(0, 6)
        .map((line) => ({
          product_or_service: typeof line.product_or_service === 'string' ? line.product_or_service : null,
          description: typeof line.description === 'string' ? line.description : null,
          amount_cents: typeof line.amount_cents === 'number' ? line.amount_cents : null,
        }))
    : undefined;
  return {
    token: row.token,
    estimateId: row.estimateId,
    estimateNumber: typeof row.estimateNumber === 'string' ? row.estimateNumber : row.estimateId.slice(0, 8),
    amountCents: typeof row.amountCents === 'number' ? row.amountCents : 0,
    depositCents: typeof row.depositCents === 'number' ? row.depositCents : 0,
    status,
    validUntilDate: typeof row.validUntilDate === 'string' ? row.validUntilDate : null,
    businessName: typeof row.businessName === 'string' ? row.businessName : null,
    businessLogo: typeof row.businessLogo === 'string' ? row.businessLogo : null,
    viewUrl: row.viewUrl,
    lineItemsPreview,
    approvedAt: typeof row.approvedAt === 'string' ? row.approvedAt : undefined,
    depositPaymentUrl: typeof row.depositPaymentUrl === 'string' ? row.depositPaymentUrl : null,
    place: asDocPlace(row.place),
  };
}

export function parseAgentPayload(value: unknown): ProAgentPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const payload: ProAgentPayload = {};
  if (Array.isArray(row.pros)) {
    const pros = row.pros.map(asProCard).filter((pro): pro is ProAgentProCard => pro !== null);
    if (pros.length) payload.pros = pros.slice(0, 3);
  }
  if (row.confirm && typeof row.confirm === 'object') {
    const confirm = row.confirm as Record<string, unknown>;
    const summary = asSummary(confirm.summary);
    if (typeof confirm.stepId === 'string' && summary) {
      payload.confirm = { stepId: confirm.stepId, summary };
    }
  }
  if (row.confirmed === true) payload.confirmed = true;
  const crmInvoice = asCrmInvoice(row.crmInvoice);
  if (crmInvoice) payload.crmInvoice = crmInvoice;
  const crmEstimate = asCrmEstimate(row.crmEstimate);
  if (crmEstimate) payload.crmEstimate = crmEstimate;
  if (row.placeShare && typeof row.placeShare === 'object') {
    const share = row.placeShare as Record<string, unknown>;
    if (typeof share.placeId === 'string') {
      payload.placeShare = {
        placeId: share.placeId,
        name: typeof share.name === 'string' ? share.name : '',
        address: typeof share.address === 'string' ? share.address : '',
        ...(typeof share.crmCustomerId === 'string' ? { crmCustomerId: share.crmCustomerId } : {}),
      };
    }
  }
  if (row.bookingInvite && typeof row.bookingInvite === 'object') {
    const invite = row.bookingInvite as Record<string, unknown>;
    if (typeof invite.businessId === 'string') {
      payload.bookingInvite = {
        businessId: invite.businessId,
        businessName: typeof invite.businessName === 'string' ? invite.businessName : '',
      };
    }
  }
  if (row.placeLinked && typeof row.placeLinked === 'object') {
    const linked = row.placeLinked as Record<string, unknown>;
    if (typeof linked.placeId === 'string') {
      payload.placeLinked = { placeId: linked.placeId, name: typeof linked.name === 'string' ? linked.name : '' };
    }
  }
  if (!payload.pros && !payload.confirm && !payload.confirmed && !payload.crmEstimate && !payload.crmInvoice && !payload.placeShare && !payload.bookingInvite && !payload.placeLinked) return null;
  return payload;
}

export function agentStepLabel(toolName: string, status: string): string {
  if (toolName === 'create_estimate' && status === 'needs_confirm') return 'Waiting for the homeowner to confirm';
  if (toolName === 'create_estimate' && status === 'confirmed') return 'Estimate filed';
  if (toolName === 'search_pros' && status === 'ok') return 'Searched pros';
  if (toolName === 'get_pro' && status === 'ok') return 'Read a pro';
  if (toolName === 'list_categories' && status === 'ok') return 'Listed categories';
  if (status === 'failed') return 'Step failed';
  if (status === 'fallback') return 'Used the fallback reply';
  return toolName;
}
