/**
 * Lead referrals: the admin sends a site estimate request to one pro (lead_referrals, migration 158).
 *
 * The pro gets an email and a ProBot card in their own ProBot thread (an unread ProBot message is
 * what lights the pro's bell). The email and the card show only the job: type, area, details,
 * budget, timeline. The customer's name, phone, email and street stay hidden until the pro taps
 * "Add to my CRM"; then the contact is created and the customer gets an email naming the pro.
 * An offer nobody answers expires after 48 hours (/api/cron/lead-expiry). The admin bell hears
 * about every answer. Pro-facing text uses the pro's language; the customer email uses the
 * customer's (from their profile when they have an account, else English).
 */
import { createServiceRoleClient } from '@/lib/supabase/server';
import { brandedEmail, hubEmailBrand } from '@/lib/email/branded-layout';
import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';
import { escapeHtml } from '@/lib/utils/sanitize';
import { recordAdminBellEvent } from '@/lib/services/adminNotifications';
import type { ChatLeadOffer } from '@/lib/types/chat';
import type { Json } from '@/lib/types/supabase';

type Admin = ReturnType<typeof createServiceRoleClient>;
export type LeadLocale = 'en' | 'es' | 'pt';

export const LEAD_OFFER_HOURS = 48;

const PROJECTS: Record<LeadLocale, Record<string, string>> = {
  en: {
    new_construction: 'New construction',
    renovation: 'Renovation',
    repair: 'Repair',
    remodel: 'Remodel',
    addition_extension: 'Addition / extension',
    maintenance: 'Maintenance',
    other: 'Other',
  },
  es: {
    new_construction: 'Construcción nueva',
    renovation: 'Renovación',
    repair: 'Reparación',
    remodel: 'Remodelación',
    addition_extension: 'Ampliación',
    maintenance: 'Mantenimiento',
    other: 'Otro',
  },
  pt: {
    new_construction: 'Construção nova',
    renovation: 'Renovação',
    repair: 'Reparo',
    remodel: 'Reforma',
    addition_extension: 'Ampliação',
    maintenance: 'Manutenção',
    other: 'Outro',
  },
};

const BUDGETS: Record<LeadLocale, Record<string, string>> = {
  en: { under_5k: 'Under $5k', '5k_10k': '$5k–$10k', '10k_25k': '$10k–$25k', '25k_50k': '$25k–$50k', '50k_100k': '$50k–$100k', over_100k: 'Over $100k', not_sure: 'Not sure' },
  es: { under_5k: 'Menos de $5k', '5k_10k': '$5k–$10k', '10k_25k': '$10k–$25k', '25k_50k': '$25k–$50k', '50k_100k': '$50k–$100k', over_100k: 'Más de $100k', not_sure: 'No sé' },
  pt: { under_5k: 'Menos de $5k', '5k_10k': '$5k–$10k', '10k_25k': '$10k–$25k', '25k_50k': '$25k–$50k', '50k_100k': '$50k–$100k', over_100k: 'Mais de $100k', not_sure: 'Não sei' },
};

const TIMELINES: Record<LeadLocale, Record<string, string>> = {
  en: { asap: 'As soon as possible', within_month: 'Within a month', '1_3_months': '1–3 months', '3_6_months': '3–6 months', '6_plus_months': '6+ months', flexible: 'Flexible' },
  es: { asap: 'Lo antes posible', within_month: 'En un mes', '1_3_months': '1–3 meses', '3_6_months': '3–6 meses', '6_plus_months': 'Más de 6 meses', flexible: 'Flexible' },
  pt: { asap: 'O quanto antes', within_month: 'Em um mês', '1_3_months': '1–3 meses', '3_6_months': '3–6 meses', '6_plus_months': 'Mais de 6 meses', flexible: 'Flexível' },
};

const CONTACT: Record<LeadLocale, Record<string, string>> = {
  en: { phone: 'Phone call', email: 'Email', text: 'Text message', either: 'Any' },
  es: { phone: 'Llamada', email: 'Email', text: 'Mensaje de texto', either: 'Cualquiera' },
  pt: { phone: 'Ligação', email: 'Email', text: 'Mensagem de texto', either: 'Qualquer' },
};

const COPY = {
  en: {
    notePrefix: 'Job request from House Pros Hub',
    project: 'Project',
    budget: 'Budget',
    timeline: 'Timeline',
    contact: 'Preferred contact',
    notes: 'Notes',
    photos: 'Photos',
    area: 'Area',
    chat: (card: ChatLeadOffer) =>
      `New job request: ${card.projectType}${card.area ? ` in ${card.area}` : ''}. Tap Add to my CRM to get the customer's contact info.`,
    offerSubject: (card: ChatLeadOffer) => `New job request: ${card.projectType}${card.area ? ` in ${card.area}` : ''}`,
    offerTitle: 'You have a new job request',
    offerHi: (name: string) => `Hi ${name}, House Pros Hub sent you a customer request.`,
    offerHow: "Open ProBot and tap <b>Add to my CRM</b> to get the customer's name, phone and address.",
    offerButton: 'Open ProBot',
    offerFoot: `Not a fit? Tap Decline in ProBot so we can send it to another pro. The request expires in ${LEAD_OFFER_HOURS} hours.`,
    introSubject: (business: string) => `${business} will contact you about your request`,
    introTitle: 'A pro is on your request',
    introHi: (name: string) => `Hi ${name || 'there'},`,
    introBody: (project: string, business: string) => `We sent your ${project.toLowerCase()} request to <b>${business}</b>. They will contact you soon.`,
    phone: 'Phone',
    email: 'Email',
    introFoot: 'Questions? Reply to this email.',
  },
  es: {
    notePrefix: 'Solicitud de trabajo de House Pros Hub',
    project: 'Proyecto',
    budget: 'Presupuesto',
    timeline: 'Plazo',
    contact: 'Contacto preferido',
    notes: 'Notas',
    photos: 'Fotos',
    area: 'Zona',
    chat: (card: ChatLeadOffer) =>
      `Nueva solicitud de trabajo: ${card.projectType}${card.area ? ` en ${card.area}` : ''}. Toca Agregar a mi CRM para ver los datos del cliente.`,
    offerSubject: (card: ChatLeadOffer) => `Nueva solicitud de trabajo: ${card.projectType}${card.area ? ` en ${card.area}` : ''}`,
    offerTitle: 'Tienes una nueva solicitud de trabajo',
    offerHi: (name: string) => `Hola ${name}, House Pros Hub te envió la solicitud de un cliente.`,
    offerHow: 'Abre ProBot y toca <b>Agregar a mi CRM</b> para ver el nombre, teléfono y dirección del cliente.',
    offerButton: 'Abrir ProBot',
    offerFoot: `¿No te interesa? Toca Rechazar en ProBot para enviarla a otro profesional. La solicitud vence en ${LEAD_OFFER_HOURS} horas.`,
    introSubject: (business: string) => `${business} te contactará sobre tu solicitud`,
    introTitle: 'Un profesional tomó tu solicitud',
    introHi: (name: string) => `Hola ${name || ''},`.replace(' ,', ','),
    introBody: (project: string, business: string) => `Enviamos tu solicitud de ${project.toLowerCase()} a <b>${business}</b>. Te contactarán pronto.`,
    phone: 'Teléfono',
    email: 'Email',
    introFoot: '¿Preguntas? Responde a este email.',
  },
  pt: {
    notePrefix: 'Pedido de serviço do House Pros Hub',
    project: 'Projeto',
    budget: 'Orçamento',
    timeline: 'Prazo',
    contact: 'Contato preferido',
    notes: 'Observações',
    photos: 'Fotos',
    area: 'Região',
    chat: (card: ChatLeadOffer) =>
      `Novo pedido de serviço: ${card.projectType}${card.area ? ` em ${card.area}` : ''}. Toque em Adicionar ao meu CRM para ver os dados do cliente.`,
    offerSubject: (card: ChatLeadOffer) => `Novo pedido de serviço: ${card.projectType}${card.area ? ` em ${card.area}` : ''}`,
    offerTitle: 'Você tem um novo pedido de serviço',
    offerHi: (name: string) => `Olá ${name}, o House Pros Hub enviou o pedido de um cliente para você.`,
    offerHow: 'Abra o ProBot e toque em <b>Adicionar ao meu CRM</b> para ver nome, telefone e endereço do cliente.',
    offerButton: 'Abrir ProBot',
    offerFoot: `Não é para você? Toque em Recusar no ProBot para enviarmos a outro profissional. O pedido expira em ${LEAD_OFFER_HOURS} horas.`,
    introSubject: (business: string) => `${business} vai entrar em contato sobre o seu pedido`,
    introTitle: 'Um profissional pegou o seu pedido',
    introHi: (name: string) => `Olá ${name || ''},`.replace(' ,', ','),
    introBody: (project: string, business: string) => `Enviamos o seu pedido de ${project.toLowerCase()} para <b>${business}</b>. Eles vão entrar em contato em breve.`,
    phone: 'Telefone',
    email: 'Email',
    introFoot: 'Dúvidas? Responda a este email.',
  },
} as const;

export const LEAD_ESTIMATE_COLUMNS =
  'id, user_id, first_name, last_name, email, phone, street_address, apartment, city, state, zip_code, project_type, project_type_other, project_description, additional_notes, budget_range, timeline, preferred_contact_method, project_images, created_at';

export interface LeadEstimate {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  street_address: string;
  apartment: string | null;
  city: string;
  state: string;
  zip_code: string;
  project_type: string;
  project_type_other: string | null;
  project_description: string;
  additional_notes: string | null;
  budget_range: string;
  timeline: string;
  preferred_contact_method: string;
  project_images: Json | null;
  created_at: string;
}

export function asLeadLocale(value: string | null | undefined): LeadLocale {
  const short = (value ?? '').trim().toLowerCase().slice(0, 2);
  return short === 'es' || short === 'pt' ? short : 'en';
}

/** The account's language (Settings > Language), English when unknown. */
export async function userLocale(admin: Admin, userId: string | null | undefined): Promise<LeadLocale> {
  if (!userId) return 'en';
  const { data } = await admin.from('profiles').select('preferred_locale').eq('id', userId).maybeSingle();
  return asLeadLocale(data?.preferred_locale);
}

export function leadProjectLabel(estimate: Pick<LeadEstimate, 'project_type' | 'project_type_other'>, locale: LeadLocale = 'en'): string {
  if (estimate.project_type === 'other' && estimate.project_type_other?.trim()) return estimate.project_type_other.trim();
  return PROJECTS[locale][estimate.project_type] ?? estimate.project_type.replaceAll('_', ' ');
}

export function leadPhotos(estimate: Pick<LeadEstimate, 'project_images'>): string[] {
  const value = estimate.project_images;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && /^https:\/\//.test(item));
}

/** What the pro sees before accepting: no name, phone, email or street. */
export function leadOfferCard(estimate: LeadEstimate, referralId: string, locale: LeadLocale): ChatLeadOffer {
  const area = [estimate.city, [estimate.state, estimate.zip_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    referralId,
    projectType: leadProjectLabel(estimate, locale),
    area,
    description: estimate.project_description.trim().slice(0, 600),
    budget: BUDGETS[locale][estimate.budget_range] ?? '',
    timeline: TIMELINES[locale][estimate.timeline] ?? '',
    photoCount: leadPhotos(estimate).length,
    status: 'offered',
  };
}

/** ProBot's text under the card (also what shows in chat previews). */
export function leadChatText(card: ChatLeadOffer, locale: LeadLocale): string {
  return COPY[locale].chat(card);
}

/** Everything from the request, for the CRM contact's notes once the pro accepts. */
export function leadNote(estimate: LeadEstimate, locale: LeadLocale): string {
  const c = COPY[locale];
  const lines = [
    `${c.notePrefix} (${new Date(estimate.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : locale)})`,
    `${c.project}: ${leadProjectLabel(estimate, locale)}`,
    BUDGETS[locale][estimate.budget_range] ? `${c.budget}: ${BUDGETS[locale][estimate.budget_range]}` : '',
    TIMELINES[locale][estimate.timeline] ? `${c.timeline}: ${TIMELINES[locale][estimate.timeline]}` : '',
    CONTACT[locale][estimate.preferred_contact_method] ? `${c.contact}: ${CONTACT[locale][estimate.preferred_contact_method]}` : '',
    estimate.project_description.trim() ? `\n${estimate.project_description.trim()}` : '',
    estimate.additional_notes?.trim() ? `\n${c.notes}: ${estimate.additional_notes.trim()}` : '',
    ...leadPhotos(estimate).map((url, index) => (index === 0 ? `\n${c.photos}:\n${url}` : url)),
  ].filter(Boolean);
  return lines.join('\n').slice(0, 5000);
}

/** The pro's own ProBot thread (where ProBot talks to them); created if they never opened ProBot. */
export async function proProbotConversation(admin: Admin, userId: string): Promise<string> {
  const { data: existing } = await admin
    .from('probot_conversations')
    .select('id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await admin
    .from('probot_conversations')
    .insert({ visitor_id: crypto.randomUUID(), user_id: userId })
    .select('id')
    .single();
  if (error || !created) throw new Error(error?.message || 'Could not open the pro ProBot thread');
  return created.id;
}

/** Update the card on the pro's ProBot message (status, and the contact once accepted). */
export async function updateLeadCard(admin: Admin, messageId: string | null, patch: Partial<ChatLeadOffer>): Promise<void> {
  if (!messageId) return;
  const { data } = await admin.from('probot_messages').select('payload').eq('id', messageId).maybeSingle();
  const payload = (data?.payload && typeof data.payload === 'object' && !Array.isArray(data.payload) ? data.payload : {}) as Record<string, unknown>;
  const current = (payload.leadOffer && typeof payload.leadOffer === 'object' ? payload.leadOffer : {}) as Record<string, unknown>;
  const { error } = await admin
    .from('probot_messages')
    .update({ payload: { ...payload, leadOffer: { ...current, ...patch } } as Json })
    .eq('id', messageId);
  if (error) console.error('[leads] update card', error.message);
}

export type OpenLead = ChatLeadOffer & { createdAt: string; expiresAt: string };

/**
 * Job requests waiting for this owner's answer (Contacts "pending approval" list, the menu badge,
 * the bell modal). The card comes from the ProBot message so it reads the same everywhere.
 */
export async function listOpenLeads(admin: Admin, ownerId: string): Promise<OpenLead[]> {
  const { data: rows, error } = await admin
    .from('lead_referrals')
    .select('id, estimate_id, message_id, created_at, expires_at')
    .eq('owner_id', ownerId)
    .eq('status', 'offered')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !rows?.length) return [];
  const messageIds = rows.map((row) => row.message_id).filter((id): id is string => Boolean(id));
  const cardByMessage = new Map<string, ChatLeadOffer>();
  if (messageIds.length) {
    const { data: messages } = await admin.from('probot_messages').select('id, payload').in('id', messageIds);
    for (const message of messages ?? []) {
      const payload = message.payload as { leadOffer?: ChatLeadOffer } | null;
      if (payload?.leadOffer?.referralId) cardByMessage.set(message.id, payload.leadOffer);
    }
  }
  // A card whose message is gone: rebuild it from the request.
  const missing = rows.filter((row) => !row.message_id || !cardByMessage.has(row.message_id));
  const estimateById = new Map<string, LeadEstimate>();
  if (missing.length) {
    const { data: estimates } = await admin.from('estimates').select(LEAD_ESTIMATE_COLUMNS).in('id', missing.map((row) => row.estimate_id));
    for (const estimate of (estimates ?? []) as LeadEstimate[]) estimateById.set(estimate.id, estimate);
  }
  const locale = missing.length ? await userLocale(admin, ownerId) : 'en';
  return rows.flatMap((row) => {
    const card = (row.message_id && cardByMessage.get(row.message_id)) || (estimateById.has(row.estimate_id) ? leadOfferCard(estimateById.get(row.estimate_id)!, row.id, locale) : null);
    return card ? [{ ...card, referralId: row.id, status: 'offered' as const, createdAt: row.created_at, expiresAt: row.expires_at }] : [];
  });
}

/** The pro answered (or the offer ended): the ProBot message no longer lights their bell. */
export async function markLeadMessageRead(admin: Admin, messageId: string | null): Promise<void> {
  if (!messageId) return;
  await admin.from('probot_messages').update({ read_at: new Date().toISOString() }).eq('id', messageId).is('read_at', null);
}

/** Admin bell: the pro added, declined, or never answered. */
export async function notifyAdminOfLead(
  admin: Admin,
  referral: { business_id: string; estimate_id: string },
  eventType: 'lead_accepted' | 'lead_declined' | 'lead_expired'
): Promise<void> {
  const [{ data: business }, { data: estimate }] = await Promise.all([
    admin.from('businesses').select('business_name').eq('id', referral.business_id).maybeSingle(),
    admin.from('estimates').select('first_name, last_name, project_type, project_type_other, city').eq('id', referral.estimate_id).maybeSingle(),
  ]);
  const detail = estimate
    ? [`${estimate.first_name} ${estimate.last_name}`.trim(), leadProjectLabel(estimate), estimate.city].filter(Boolean).join(' · ')
    : null;
  await recordAdminBellEvent({
    eventType,
    entityType: 'business',
    entityId: referral.business_id,
    displayName: business?.business_name ?? 'A pro',
    detail,
  });
}

export function siteOrigin(fallback: string): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return fallback.replace(/\/+$/, '');
}

function emailFrame(title: string, body: string, locale: LeadLocale): string {
  return brandedEmail({ brand: hubEmailBrand(), heading: title, bodyHtml: '<div lang="' + locale + '" style="font-size:15px;line-height:1.55;color:#111827;">' + body + '</div>' });
}

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    await getResendClient().emails.send({ from: getResendFromEmail(), to, subject, html });
  } catch (error) {
    console.error('[leads] email failed', error instanceof Error ? error.message : error);
  }
}

/** To the pro: a new job, no customer details. */
export async function sendLeadOfferEmail(
  to: string,
  businessName: string,
  card: ChatLeadOffer,
  origin: string,
  locale: LeadLocale
): Promise<void> {
  const c = COPY[locale];
  const link = `${origin}/${locale}/probot`;
  const row = (label: string, value: string) =>
    value ? `<tr><td style="padding:4px 12px 4px 0;color:#555">${label}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>` : '';
  const html = emailFrame(
    c.offerTitle,
    `<p>${c.offerHi(escapeHtml(businessName))}</p>
     <table style="font-size:14px;border-collapse:collapse;margin:8px 0 12px">
       ${row(c.project, card.projectType)}${row(c.area, card.area)}${row(c.budget, card.budget)}${row(c.timeline, card.timeline)}
     </table>
     ${card.description ? `<p style="background:#f5f5f5;border-radius:8px;padding:10px;font-size:14px;white-space:pre-wrap">${escapeHtml(card.description.slice(0, 400))}</p>` : ''}
     <p>${c.offerHow}</p>
     <p style="margin:18px 0"><a href="${escapeHtml(link)}" style="background:#000;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold;display:inline-block">${c.offerButton}</a></p>
     <p style="font-size:12px;color:#555">${c.offerFoot}</p>`,
    locale
  );
  await send(to, c.offerSubject(card), html);
}

/** To the customer once the pro accepted: who will contact them. */
export async function sendCustomerIntroEmail(
  to: string,
  firstName: string,
  business: { name: string; phone: string | null; email: string | null },
  estimate: Pick<LeadEstimate, 'project_type' | 'project_type_other'>,
  locale: LeadLocale
): Promise<void> {
  const c = COPY[locale];
  const contact = [
    business.phone ? `${c.phone}: <b>${escapeHtml(business.phone)}</b>` : '',
    business.email ? `${c.email}: <b>${escapeHtml(business.email)}</b>` : '',
  ]
    .filter(Boolean)
    .join('<br/>');
  const html = emailFrame(
    c.introTitle,
    `<p>${c.introHi(escapeHtml(firstName))}</p>
     <p>${c.introBody(escapeHtml(leadProjectLabel(estimate, locale)), escapeHtml(business.name))}</p>
     ${contact ? `<p style="background:#f5f5f5;border-radius:8px;padding:10px;font-size:14px">${contact}</p>` : ''}
     <p style="font-size:12px;color:#555">${c.introFoot}</p>`,
    locale
  );
  await send(to, c.introSubject(business.name), html);
}
