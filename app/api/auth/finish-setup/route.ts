import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMessages } from 'next-intl/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { US_PHONE_REGEX } from '@/lib/schemas/auth';
import { REFERRAL_OTHER } from '@/lib/constants/referral';
import { locales, type Locale } from '@/i18n';
import { logger } from '@/lib/utils/logger';
import { sendWelcomeEmail, sendNewSignupAdminNotification } from '@/lib/services/emailService';
import { recordAdminBellEvent } from '@/lib/services/adminNotifications';
import type { WelcomeEmailTranslations } from '@/lib/utils/emailTemplates';

const finishSchema = z
  .object({
    referral: z.string().trim().min(1).max(200),
    referralOther: z.string().trim().max(200).optional(),
    phone: z.string().trim().regex(US_PHONE_REGEX),
    agreeToTerms: z.literal(true),
    locale: z.enum(locales).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.referral === REFERRAL_OTHER && !data.referralOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['referralOther'],
        message: 'Please enter how you heard about us',
      });
    }
  });

/**
 * POST /api/auth/finish-setup
 * Saves how a Google customer heard about the Hub, their phone, and their
 * acceptance of the terms. Clears the pending flag so they can enter.
 * The account already exists; this is the step that finishes it.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'auth');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const parsed = finishSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Check the phone, referral, and terms.' }, { status: 400 });
    }

    const { referral, referralOther, phone, locale: requestedLocale } = parsed.data;
    const locale: Locale = requestedLocale ?? 'en';
    const service = createServiceRoleClient();

    const { data: saved, error: saveError } = await service
      .from('profiles')
      .update({
        phone,
        referral,
        referral_other: referralOther?.trim() || null,
        account_setup_pending: false,
      })
      .eq('id', user.id)
      .eq('account_setup_pending', true)
      .select('first_name, last_name')
      .maybeSingle();

    if (saveError) {
      logger.error('[Finish setup] failed to save', { userId: user.id, error: saveError.message });
      return NextResponse.json({ error: 'Could not finish your account. Please try again.' }, { status: 500 });
    }

    if (!saved) {
      return NextResponse.json({ alreadyComplete: true });
    }

    const email = user.email?.trim().toLowerCase() ?? '';
    const firstName = saved.first_name?.trim() || 'Customer';
    const lastName = saved.last_name?.trim() || '';
    const displayName = `${firstName} ${lastName}`.trim();

    await recordAdminBellEvent({
      eventType: 'signup',
      entityType: 'customer',
      entityId: user.id,
      displayName,
      detail: email || null,
    });

    if (email) {
      const adminNotify = await sendNewSignupAdminNotification({
        type: 'customer',
        name: displayName,
        email,
        phone,
      });
      if (!adminNotify.success) {
        logger.warn('[Finish setup] failed to email admin', { userId: user.id, error: adminNotify.error });
      }
      await sendCustomerWelcome(locale, { firstName, lastName, email, userId: user.id });
    }

    return NextResponse.json({
      phone,
      referral,
      referralOther: referralOther?.trim() || null,
    });
  } catch (error) {
    logger.error('[Finish setup] unhandled', {}, error as Error);
    return NextResponse.json({ error: 'Could not finish your account. Please try again.' }, { status: 500 });
  }
}

async function sendCustomerWelcome(
  locale: string,
  person: { firstName: string; lastName: string; email: string; userId: string }
) {
  try {
    const messages = await getMessages({ locale });
    const welcome = messages?.auth?.welcomeEmail as Record<string, unknown> | undefined;
    const footer = welcome?.footer as Record<string, string> | undefined;
    if (!welcome) {
      logger.warn('[Finish setup] welcome email translations missing', { locale });
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';
    const translations: WelcomeEmailTranslations = {
      subject: typeof welcome?.subject === 'string' ? welcome.subject : 'Welcome to House Pros Hub!',
      greeting: typeof welcome?.greeting === 'string' ? welcome.greeting : 'Hello',
      customerWelcomeMessage: typeof welcome?.customerWelcomeMessage === 'string' ? welcome.customerWelcomeMessage : '',
      contractorWelcomeMessage: typeof welcome?.contractorWelcomeMessage === 'string' ? welcome.contractorWelcomeMessage : '',
      bothWelcomeMessage: typeof welcome?.bothWelcomeMessage === 'string' ? welcome.bothWelcomeMessage : '',
      nextSteps: typeof welcome?.nextSteps === 'string' ? welcome.nextSteps : 'Next Steps',
      customerNextSteps: typeof welcome?.customerNextSteps === 'string' ? welcome.customerNextSteps : '',
      contractorNextSteps: typeof welcome?.contractorNextSteps === 'string' ? welcome.contractorNextSteps : '',
      bothNextSteps: typeof welcome?.bothNextSteps === 'string' ? welcome.bothNextSteps : '',
      siteUrl,
      footer: {
        companyName: footer?.companyName || 'House Pros Hub',
        contactInfo: footer?.contactInfo || 'If you have any questions, please contact us.',
        unsubscribe: footer?.unsubscribe || 'You are receiving this email because you created an account with House Pros Hub.',
      },
    };
    const result = await sendWelcomeEmail(
      {
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        userType: 'customer',
      },
      person.email,
      translations
    );
    if (!result.success) {
      logger.warn('[Finish setup] failed to send welcome email', { userId: person.userId, error: result.error });
    }
  } catch (error) {
    logger.error('[Finish setup] welcome email threw', { userId: person.userId }, error as Error);
  }
}
