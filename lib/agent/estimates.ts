import { getTranslations } from 'next-intl/server';
import { estimateSchema } from '@/lib/schemas/estimate';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEstimateEmails } from '@/lib/services/emailService';
import type { EmailTranslations, EstimateEmailData } from '@/lib/utils/emailTemplates';
import { logger } from '@/lib/utils/logger';
import type { AgentApp } from '@/lib/agent/auth';
import { isMissingAgentStorage } from '@/lib/agent/auth';
import {
  AGENT_RULE,
  ESTIMATE_MESSAGE,
  type AgentLocale,
} from '@/lib/agent/constants';

export interface AgentEstimateResult {
  ok: true;
  status: number;
  body: {
    success: true;
    estimateId: string;
    idempotent: boolean;
    messageForUser: string;
    rules: string;
  };
}

export interface AgentEstimateFailure {
  ok: false;
  status: number;
  body: { error: string; details?: unknown };
}

async function emailTranslations(locale: AgentLocale): Promise<EmailTranslations> {
  const t = await getTranslations({ locale, namespace: 'estimate.email' });
  const tSections = await getTranslations({ locale, namespace: 'estimate.email.sections' });
  const tFooter = await getTranslations({ locale, namespace: 'estimate.email.footer' });
  const tAdmin = await getTranslations({ locale, namespace: 'estimate.email.admin' });

  return {
    subject: t('subject'),
    subjectAdmin: t('subjectAdmin'),
    greeting: t('greeting'),
    thankYou: t('thankYou'),
    thankYouAdmin: t('thankYouAdmin'),
    proWillContact: t('proWillContact'),
    copyBelow: t('copyBelow'),
    agentNotice: t('agentNotice'),
    sections: {
      customerInfo: tSections('customerInfo'),
      projectAddress: tSections('projectAddress'),
      projectDetails: tSections('projectDetails'),
      projectType: tSections('projectType'),
      trades: tSections('trades'),
      description: tSections('description'),
      images: tSections('images'),
      budget: tSections('budget'),
      timeline: tSections('timeline'),
      contactPreference: tSections('contactPreference'),
      additionalNotes: tSections('additionalNotes'),
      hoaApproval: tSections('hoaApproval'),
      wants3D: tSections('wants3D'),
    },
    footer: {
      companyName: tFooter('companyName'),
      contactInfo: tFooter('contactInfo'),
      unsubscribe: tFooter('unsubscribe'),
    },
    admin: {
      estimateId: tAdmin('estimateId'),
      submittedAt: tAdmin('submittedAt'),
      userId: tAdmin('userId'),
      anonymous: tAdmin('anonymous'),
      source: tAdmin('source'),
      viaAgent: tAdmin('viaAgent'),
      viaWebsite: tAdmin('viaWebsite'),
      viaQuickRepair: tAdmin('viaQuickRepair'),
    },
    yes: t('yes'),
    no: t('no'),
    noneSelected: t('noneSelected'),
    noImagesProvided: t('noImagesProvided'),
  };
}

function successBody(id: string, locale: AgentLocale, idempotent: boolean): AgentEstimateResult {
  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      estimateId: id,
      idempotent,
      messageForUser: ESTIMATE_MESSAGE[locale],
      rules: AGENT_RULE,
    },
  };
}

/**
 * Open an estimate from an agent app.
 * A repeated idempotency key returns the original request and does not send a second email.
 */
export async function createAgentEstimate(input: {
  app: AgentApp;
  body: unknown;
  locale: AgentLocale;
  idempotencyKey: string | null;
}): Promise<AgentEstimateResult | AgentEstimateFailure> {
  const parsed = estimateSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Invalid estimate. budgetRange is the homeowner\'s range, not a quote.',
        details: parsed.error.issues,
      },
    };
  }

  const estimate = parsed.data;
  const supabase = createServiceRoleClient();

  if (input.idempotencyKey) {
    const { data: existing, error: existingError } = await supabase
      .from('estimates')
      .select('id')
      .eq('agent_app_id', input.app.id)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();

    if (existingError) {
      if (isMissingAgentStorage(existingError)) {
        return {
          ok: false,
          status: 503,
          body: { error: 'Agent storage is not ready. Apply supabase/migrations/077_agent_apps.sql.' },
        };
      }
    } else if (existing) {
      return successBody(existing.id, input.locale, true);
    }
  }

  const { data: saved, error } = await supabase
    .from('estimates')
    .insert({
      first_name: estimate.firstName,
      last_name: estimate.lastName,
      email: estimate.email,
      phone: estimate.phone,
      street_address: estimate.streetAddress,
      city: estimate.city,
      state: estimate.state,
      zip_code: estimate.zipCode,
      apartment: estimate.apartment || null,
      project_type: estimate.projectType!,
      project_type_other: estimate.projectTypeOther || null,
      requires_hoa_approval: estimate.requiresHoaApproval,
      wants_3d: estimate.wants3D,
      trades: estimate.trades,
      project_description: estimate.projectDescription ?? '',
      project_images: estimate.projectImages || null,
      budget_range: estimate.budgetRange!,
      timeline: estimate.timeline!,
      preferred_contact_method: estimate.preferredContactMethod!,
      additional_notes: estimate.additionalNotes || null,
      user_id: null,
      source: 'agent',
      agent_app_id: input.app.id,
      idempotency_key: input.idempotencyKey,
    })
    .select('id, created_at')
    .single();

  if (error) {
    if (input.idempotencyKey && error.code === '23505') {
      const { data: raced } = await supabase
        .from('estimates')
        .select('id')
        .eq('agent_app_id', input.app.id)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();
      if (raced) return successBody(raced.id, input.locale, true);
    }
    if (isMissingAgentStorage(error)) {
      return {
        ok: false,
        status: 503,
        body: { error: 'Agent storage is not ready. Apply supabase/migrations/077_agent_apps.sql.' },
      };
    }
    logger.error('Agent estimate insert failed', { agentAppId: input.app.id }, error as Error);
    return { ok: false, status: 500, body: { error: 'Failed to save estimate' } };
  }

  const translations = await emailTranslations(input.locale);
  const emailData: EstimateEmailData = {
    ...estimate,
    estimateId: saved.id,
    submittedAt: new Date(saved.created_at).toLocaleString(
      input.locale === 'es' ? 'es-US' : input.locale === 'pt' ? 'pt-BR' : 'en-US'
    ),
    userId: null,
    agentAppName: input.app.name,
  };

  const emailResult = await sendEstimateEmails(emailData, estimate.email, translations);
  if (emailResult.errors.length > 0) {
    logger.warn('Agent estimate emails failed', {
      estimateId: saved.id,
      agentAppId: input.app.id,
      errors: emailResult.errors,
    });
  }

  return successBody(saved.id, input.locale, false);
}

export async function getAgentEstimate(input: {
  app: AgentApp;
  id: string;
  locale: AgentLocale;
}): Promise<AgentEstimateResult | AgentEstimateFailure | { ok: true; status: 200; body: Record<string, unknown> }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('id, created_at, project_type, trades, city, state, agent_app_id')
    .eq('id', input.id)
    .eq('agent_app_id', input.app.id)
    .maybeSingle();

  if (error) {
    if (isMissingAgentStorage(error)) {
      return {
        ok: false,
        status: 503,
        body: { error: 'Agent storage is not ready. Apply supabase/migrations/077_agent_apps.sql.' },
      };
    }
    return { ok: false, status: 500, body: { error: 'Failed to load estimate' } };
  }
  if (!data) {
    return { ok: false, status: 404, body: { error: 'Estimate not found' } };
  }

  return {
    ok: true,
    status: 200,
    body: {
      id: data.id,
      status: 'received',
      createdAt: data.created_at,
      projectType: data.project_type,
      trades: data.trades,
      city: data.city,
      state: data.state,
      messageForUser: ESTIMATE_MESSAGE[input.locale],
      rules: AGENT_RULE,
    },
  };
}
