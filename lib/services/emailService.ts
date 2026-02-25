import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';
import { generateEstimateConfirmationEmail, type EmailTranslations, type EstimateEmailData, generateWelcomeEmail, type WelcomeEmailTranslations, type WelcomeEmailData, generateSetPasswordEmail, type SetPasswordEmailTranslations, generateIncomingEmailNotification, type IncomingEmailNotificationData, generateNewSignupAdminNotification, type NewSignupAdminNotificationData } from '@/lib/utils/emailTemplates';
import { logger } from '@/lib/utils/logger';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import type { ParsedEmail } from '@/lib/utils/emailParser';

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

/**
 * Send admin notification when a new customer signs up, new contractor signs up, or new business is added.
 */
export async function sendNewSignupAdminNotification(
  data: NewSignupAdminNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();

    if (!ADMIN_EMAIL) {
      logger.warn('ADMIN_EMAIL is not configured, skipping new signup admin notification', {
        endpoint: 'email-service',
      });
      return { success: false, error: 'Admin email not configured' };
    }

    const subject =
      data.type === 'customer'
        ? 'New customer signed up – House Pros Hub'
        : data.type === 'contractor'
          ? 'New contractor signed up – House Pros Hub'
          : 'New business added – House Pros Hub';
    const html = generateNewSignupAdminNotification(data);

    const { data: resData, error } = await resend.emails.send({
      from: fromEmail,
      to: ADMIN_EMAIL,
      subject,
      html,
    });

    if (error) {
      logger.error('Failed to send new signup admin notification', {
        endpoint: 'email-service',
        adminEmail: ADMIN_EMAIL,
        type: data.type,
        error: error.message,
      }, error as Error);
      return { success: false, error: error.message };
    }

    logger.info('New signup admin notification sent', {
      endpoint: 'email-service',
      adminEmail: ADMIN_EMAIL,
      type: data.type,
      emailId: resData?.id,
    });
    return { success: true };
  } catch (error) {
    logger.error('Error sending new signup admin notification', {
      endpoint: 'email-service',
      adminEmail: ADMIN_EMAIL,
      type: data.type,
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send "set your password" email to admin-created customer (link only, no password in email)
 */
export async function sendSetPasswordEmail(
  firstName: string,
  toEmail: string,
  setPasswordLink: string,
  translations: SetPasswordEmailTranslations
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();

    const html = generateSetPasswordEmail(firstName, setPasswordLink, translations);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: translations.subject,
      html,
    });

    if (error) {
      logger.error('Failed to send set-password email', {
        endpoint: 'email-service',
        toEmail,
        error: error.message,
      }, error as Error);
      return { success: false, error: error.message };
    }

    logger.info('Set-password email sent successfully', {
      endpoint: 'email-service',
      toEmail,
      emailId: data?.id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sending set-password email', {
      endpoint: 'email-service',
      toEmail,
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send notification email to admin when incoming email is received
 */
export async function sendIncomingEmailNotification(
  parsedEmail: ParsedEmail,
  emailId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();

    if (!ADMIN_EMAIL) {
      logger.warn('ADMIN_EMAIL is not configured, skipping incoming email notification', {
        endpoint: 'email-service',
      });
      return { success: false, error: 'Admin email not configured' };
    }

    const notificationData: IncomingEmailNotificationData = {
      fromEmail: parsedEmail.fromEmail,
      fromName: parsedEmail.fromName,
      toEmail: parsedEmail.toEmail,
      subject: parsedEmail.subject,
      textContent: parsedEmail.textContent,
      htmlContent: parsedEmail.htmlContent,
      receivedAt: new Date().toISOString(),
      hasAttachments: !!(parsedEmail.attachments && parsedEmail.attachments.length > 0),
      attachmentCount: parsedEmail.attachments?.length || 0,
      emailId,
    };

    const html = generateIncomingEmailNotification(notificationData);
    const subject = `New Email to ${parsedEmail.toEmail}: ${parsedEmail.subject || '(No Subject)'}`;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: ADMIN_EMAIL,
      subject,
      html,
      replyTo: parsedEmail.fromEmail,
    });

    if (error) {
      logger.error('Failed to send incoming email notification', {
        endpoint: 'email-service',
        adminEmail: ADMIN_EMAIL,
        toEmail: parsedEmail.toEmail,
        error: error.message,
      }, error as Error);
      return { success: false, error: error.message };
    }

    logger.info('Incoming email notification sent successfully', {
      endpoint: 'email-service',
      adminEmail: ADMIN_EMAIL,
      toEmail: parsedEmail.toEmail,
      fromEmail: parsedEmail.fromEmail,
      emailId: data?.id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error sending incoming email notification', {
      endpoint: 'email-service',
      toEmail: parsedEmail.toEmail,
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

