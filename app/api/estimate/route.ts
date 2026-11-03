import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { estimateSchema } from '@/lib/schemas/estimate';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';
import { sendEstimateEmails } from '@/lib/services/emailService';
import { recordAdminBellEvent } from '@/lib/services/adminNotifications';
import { sendAdminPushNotification } from '@/lib/services/pushNotificationService';
import { signDriveFilesForStaff } from '@/lib/drive/server';
import { getTranslations } from 'next-intl/server';
import type { EmailTranslations } from '@/lib/utils/emailTemplates';
import type { EstimateEmailData } from '@/lib/utils/emailTemplates';

/**
 * Transform estimate form data (camelCase) to database schema (snake_case)
 */
function transformEstimateToDb(estimate: z.infer<typeof estimateSchema>) {
  return {
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
    latitude: estimate.latitude ?? null,
    longitude: estimate.longitude ?? null,
    location_accuracy_m: estimate.locationAccuracyM ?? null,
    project_drive_file_ids: estimate.projectDriveFileIds ?? [],
    ...(estimate.source ? { source: estimate.source } : {}),
  };
}

/**
 * Get email translations for the given locale
 */
async function getEmailTranslations(locale: string): Promise<EmailTranslations> {
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

/**
 * POST /api/estimate
 * Submit estimate request
 * 
 * Accepts estimate form data, saves to database, and sends confirmation emails
 * to both customer and admin.
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResponse = await checkRateLimit(request, 'general');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get locale from request headers or default to 'en'
    const locale = request.headers.get('x-locale') || 'en';

    // Parse and validate request body
    const body = await request.json();
    const validationResult = estimateSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn('Invalid estimate submission', {
        endpoint: '/api/estimate',
        errors: validationResult.error.issues,
      });
      return NextResponse.json(
        { error: 'Invalid form data', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const estimateData = validationResult.data;
    const driveFileIds = estimateData.projectDriveFileIds ?? [];

    // Get authenticated user (optional - estimates can be submitted anonymously)
    const supabase = await createClient();
    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch {
      // User not authenticated - that's okay for anonymous submissions
      logger.debug('No authenticated user for estimate submission', {
        endpoint: '/api/estimate',
      });
    }

    if (driveFileIds.length > 0) {
      if (!userId) {
        return NextResponse.json({ error: 'Sign in before attaching ProDrive photos' }, { status: 401 });
      }
      const { data: ownedFiles, error: ownedError } = await supabase
        .from('pro_drive_files')
        .select('id')
        .in('id', driveFileIds)
        .eq('owner_type', 'user')
        .eq('owner_id', userId);
      if (ownedError || (ownedFiles?.length ?? 0) !== driveFileIds.length) {
        return NextResponse.json({ error: 'One or more photos are not in your ProDrive' }, { status: 400 });
      }
    }

    // Transform data for database
    const dbData = transformEstimateToDb(estimateData);

    // Save estimate to database using service role client to bypass RLS
    const serviceRoleClient = createServiceRoleClient();
    const { data: savedEstimate, error: dbError } = await serviceRoleClient
      .from('estimates')
      .insert({
        ...dbData,
        user_id: userId,
      })
      .select('id, created_at')
      .single();

    if (dbError) {
      logger.error('Error saving estimate to database', {
        endpoint: '/api/estimate',
        error: dbError.message,
      }, dbError as Error);
      return NextResponse.json(
        { error: 'Failed to save estimate' },
        { status: 500 }
      );
    }

    // Get email translations
    const emailTranslations = await getEmailTranslations(locale);
    const isQuickRepair = estimateData.source === 'quick_repair';
    if (isQuickRepair) {
      const repairCopy = await getTranslations({ locale, namespace: 'estimate.email' });
      emailTranslations.subjectAdmin = repairCopy('subjectAdminQuickRepair');
      emailTranslations.thankYouAdmin = repairCopy('thankYouAdminQuickRepair');
    }

    let projectImages = estimateData.projectImages ?? [];
    if (isQuickRepair && driveFileIds.length > 0) {
      try {
        const signed = await signDriveFilesForStaff(driveFileIds, 60 * 60 * 24 * 7);
        if (signed.length > 0) projectImages = signed.map((file) => file.url);
      } catch (signError) {
        logger.warn('Quick Repair photo links were not added to the email', {
          endpoint: '/api/estimate',
          estimateId: savedEstimate.id,
          error: signError instanceof Error ? signError.message : 'Unknown error',
        });
      }
    }

    // Prepare email data
    const emailData: EstimateEmailData = {
      ...estimateData,
      projectImages,
      estimateId: savedEstimate.id,
      submittedAt: new Date(savedEstimate.created_at).toLocaleString(locale === 'es' ? 'es-US' : locale === 'pt' ? 'pt-BR' : 'en-US'),
      userId,
    };

    // Send emails (don't fail the request if emails fail)
    const emailResult = await sendEstimateEmails(
      emailData,
      estimateData.email,
      emailTranslations
    );

    // Log email results
    if (emailResult.errors.length > 0) {
      logger.warn('Some emails failed to send', {
        endpoint: '/api/estimate',
        estimateId: savedEstimate.id,
        errors: emailResult.errors,
      });
    } else {
      logger.info('Estimate submitted and emails sent successfully', {
        endpoint: '/api/estimate',
        estimateId: savedEstimate.id,
        customerEmail: estimateData.email,
      });
    }

    const who = [estimateData.firstName, estimateData.lastName].filter(Boolean).join(' ').trim() || 'Someone';
    const place = [estimateData.city, estimateData.state].filter(Boolean).join(', ');
    await recordAdminBellEvent({
      eventType: 'estimate',
      entityType: 'estimate',
      entityId: savedEstimate.id,
      displayName: who,
      detail: isQuickRepair ? ['Quick Repair', place].filter(Boolean).join(' · ') : [estimateData.projectType, place].filter(Boolean).join(' · '),
    });

    if (isQuickRepair) {
      try {
        await sendAdminPushNotification(
          'New Quick Repair',
          `${who} just dropped a repair.`,
          '/admin/estimates',
          undefined,
          'quick-repair',
          '/icons/icon-192.png'
        );
      } catch (pushError) {
        logger.warn('Quick Repair push was not sent', {
          endpoint: '/api/estimate',
          estimateId: savedEstimate.id,
          error: pushError instanceof Error ? pushError.message : 'Unknown error',
        });
      }
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        estimateId: savedEstimate.id,
        message: 'Estimate submitted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error in POST /api/estimate', {
      endpoint: '/api/estimate',
    }, error as Error);
    return handleError(error, { endpoint: '/api/estimate' });
  }
}
