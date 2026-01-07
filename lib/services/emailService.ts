import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';
import { generateEstimateConfirmationEmail, type EmailTranslations, type EstimateEmailData, generateWelcomeEmail, type WelcomeEmailTranslations, type WelcomeEmailData } from '@/lib/utils/emailTemplates';
import { logger } from '@/lib/utils/logger';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * Send estimate confirmation email to customer
 */
export async function sendEstimateConfirmationEmail(
  estimate: EstimateEmailData,
  customerEmail: string,
  translations: EmailTranslations
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();

    const html = generateEstimateConfirmationEmail(estimate, translations, 'customer');

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: translations.subject,
      html,
    });

    if (error) {
      logger.error('Failed to send estimate confirmation email', {
        endpoint: 'email-service',
        customerEmail,
        error: error.message,
      }, error as Error);
      return { success: false, error: error.message };
    }

    logger.info('Estimate confirmation email sent successfully', {
      endpoint: 'email-service',
      customerEmail,
      emailId: data?.id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sending estimate confirmation email', {
      endpoint: 'email-service',
      customerEmail,
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send estimate notification email to admin
 */
export async function sendEstimateAdminNotification(
  estimate: EstimateEmailData,
  translations: EmailTranslations
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();

    if (!ADMIN_EMAIL) {
      logger.warn('ADMIN_EMAIL is not configured, skipping admin notification', {
        endpoint: 'email-service',
      });
      return { success: false, error: 'Admin email not configured' };
    }

    const html = generateEstimateConfirmationEmail(estimate, translations, 'admin');

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: ADMIN_EMAIL,
      subject: translations.subjectAdmin,
      html,
    });

    if (error) {
      logger.error('Failed to send estimate admin notification', {
        endpoint: 'email-service',
        adminEmail: ADMIN_EMAIL,
        error: error.message,
      }, error as Error);
      return { success: false, error: error.message };
    }

    logger.info('Estimate admin notification sent successfully', {
      endpoint: 'email-service',
      adminEmail: ADMIN_EMAIL,
      emailId: data?.id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sending estimate admin notification', {
      endpoint: 'email-service',
      adminEmail: ADMIN_EMAIL,
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send both customer confirmation and admin notification emails
 * Handles errors independently - one failure won't block the other
 */
export async function sendEstimateEmails(
  estimate: EstimateEmailData,
  customerEmail: string,
  translations: EmailTranslations
): Promise<{ customerSuccess: boolean; adminSuccess: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Send customer email
  const customerResult = await sendEstimateConfirmationEmail(estimate, customerEmail, translations);
  if (!customerResult.success) {
    errors.push(`Customer email failed: ${customerResult.error || 'Unknown error'}`);
  }

  // Send admin email (independent of customer email result)
  const adminResult = await sendEstimateAdminNotification(estimate, translations);
  if (!adminResult.success) {
    errors.push(`Admin email failed: ${adminResult.error || 'Unknown error'}`);
  }

  return {
    customerSuccess: customerResult.success,
    adminSuccess: adminResult.success,
    errors,
  };
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  userData: WelcomeEmailData,
  userEmail: string,
  translations: WelcomeEmailTranslations
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();

    const html = generateWelcomeEmail(userData, translations);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: translations.subject,
      html,
    });

    if (error) {
      logger.error('Failed to send welcome email', {
        endpoint: 'email-service',
        userEmail,
        error: error.message,
      }, error as Error);
      return { success: false, error: error.message };
    }

    logger.info('Welcome email sent successfully', {
      endpoint: 'email-service',
      userEmail,
      emailId: data?.id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sending welcome email', {
      endpoint: 'email-service',
      userEmail,
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

