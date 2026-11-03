import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';
import { generateEstimateConfirmationEmail, type EmailTranslations, type EstimateEmailData, generateWelcomeEmail, type WelcomeEmailTranslations, type WelcomeEmailData, generateSetPasswordEmail, type SetPasswordEmailTranslations, generatePasswordResetEmail, type PasswordResetEmailData, generatePasswordChangedEmail, generateIncomingEmailNotification, type IncomingEmailNotificationData, generateNewSignupAdminNotification, type NewSignupAdminNotificationData, generateProEstimateBookingEmail, type ProEstimateBookingEmailData, type ProEstimateBookingEmailTranslations, generateInvoiceEmail, type InvoiceEmailData, generateEstimateReviewEmail, type EstimateReviewEmailData, generateEstimateApprovedCustomerEmail, generateEstimateApprovedContractorEmail, generateEstimateApprovedAdminEmail, type EstimateApprovedEmailCommon } from '@/lib/utils/emailTemplates';
import { logger } from '@/lib/utils/logger';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { COMPANY_INFO } from '@/lib/constants/company';
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
          : data.type === 'realtor'
            ? 'New realtor signed up – House Pros Hub'
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
 * Send password reset email (forgot password flow). Uses custom HTML template with reset link.
 */
export async function sendPasswordResetEmail(data: {
  email: string;
  resetLink: string;
  userName?: string;
  language: 'en' | 'es' | 'pt';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();
    const subject =
      data.language === 'es'
        ? 'Restablece tu contraseña - House Pros Hub'
        : data.language === 'pt'
          ? 'Redefina sua senha - House Pros Hub'
          : 'Reset Your Password - House Pros Hub';
    const html = generatePasswordResetEmail({
      resetLink: data.resetLink,
      userName: data.userName,
      language: data.language,
    });
    const { data: emailResult, error } = await resend.emails.send({
      from: fromEmail,
      to: data.email,
      subject,
      html,
    });
    if (error) {
      logger.error('Failed to send password reset email', {
        endpoint: 'email-service',
        toEmail: data.email,
        error: error.message,
      }, error as Error);
      return { success: false, error: error.message };
    }
    logger.info('Password reset email sent successfully', {
      endpoint: 'email-service',
      toEmail: data.email,
      emailId: emailResult?.id,
    });
    return { success: true };
  } catch (error) {
    logger.error('Error sending password reset email', {
      endpoint: 'email-service',
      toEmail: data.email,
    }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Format support phone for display (e.g. 702-232-0411 → (702) 232-0411). */
function formatSupportPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
}

/**
 * Send "your password was changed" confirmation email (ADP-style).
 * Call after user successfully updates password so they're notified of the change.
 */
export async function sendPasswordChangedEmail(data: {
  email: string;
  userName?: string;
  language: 'en' | 'es' | 'pt';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();
    const subject =
      data.language === 'es'
        ? 'Tu contraseña fue cambiada'
        : data.language === 'pt'
          ? 'Sua senha foi alterada'
          : 'Your password was changed';
    const supportPhoneDisplay = formatSupportPhone(COMPANY_INFO.supportPhone ?? '702-232-0411');
    const html = generatePasswordChangedEmail({
      userName: data.userName,
      language: data.language,
      supportPhoneDisplay,
    });
    const { data: emailResult, error } = await resend.emails.send({
      from: fromEmail,
      to: data.email,
      subject,
      html,
    });
    if (error) {
      logger.error('Failed to send password changed email', {
        endpoint: 'email-service',
        toEmail: data.email,
        error: error.message,
      }, error as Error);
      return { success: false, error: error.message };
    }
    logger.info('Password changed email sent successfully', {
      endpoint: 'email-service',
      toEmail: data.email,
      emailId: emailResult?.id,
    });
    return { success: true };
  } catch (error) {
    logger.error('Error sending password changed email', {
      endpoint: 'email-service',
      toEmail: data.email,
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

/**
 * Send ProEstimate booking confirmation to customer.
 */
export async function sendProEstimateBookingCustomerEmail(
  data: ProEstimateBookingEmailData,
  translations: ProEstimateBookingEmailTranslations
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();
    const html = generateProEstimateBookingEmail(data, translations, 'customer');
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: data.customerEmail,
      subject: translations.subjectCustomer,
      html,
    });
    if (error) {
      logger.error('ProEstimate customer email failed', { customerEmail: data.customerEmail, error: error.message }, error as Error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    logger.error('ProEstimate customer email error', { customerEmail: data.customerEmail }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send ProEstimate booking notification to pro (business).
 */
export async function sendProEstimateBookingProEmail(
  data: ProEstimateBookingEmailData,
  proEmail: string,
  translations: ProEstimateBookingEmailTranslations
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();
    const html = generateProEstimateBookingEmail(data, translations, 'pro');
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: proEmail,
      subject: translations.subjectPro,
      html,
    });
    if (error) {
      logger.error('ProEstimate pro email failed', { proEmail, error: error.message }, error as Error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    logger.error('ProEstimate pro email error', { proEmail }, error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send customer, pro, and platform-admin ProEstimate booking emails.
 */
export async function sendProEstimateBookingEmails(
  data: ProEstimateBookingEmailData,
  proEmail: string,
  translations: ProEstimateBookingEmailTranslations
): Promise<{ customerSuccess: boolean; proSuccess: boolean; adminSuccess: boolean; errors: string[] }> {
  const errors: string[] = [];
  const customerResult = await sendProEstimateBookingCustomerEmail(data, translations);
  if (!customerResult.success) errors.push(`Customer: ${customerResult.error ?? 'Unknown'}`);
  const proResult = await sendProEstimateBookingProEmail(data, proEmail, translations);
  if (!proResult.success) errors.push(`Pro: ${proResult.error ?? 'Unknown'}`);

  let adminSuccess = false;
  const adminTo = ADMIN_EMAIL?.trim().toLowerCase();
  const proTo = proEmail.trim().toLowerCase();
  if (adminTo && adminTo !== '__client_side_placeholder__' && adminTo !== proTo) {
    const adminResult = await sendProEstimateBookingProEmail(data, ADMIN_EMAIL, {
      ...translations,
      subjectPro: `New booking – ${data.businessName} – House Pros Hub`,
    });
    if (!adminResult.success) errors.push(`Admin: ${adminResult.error ?? 'Unknown'}`);
    else adminSuccess = true;
  }

  return {
    customerSuccess: customerResult.success,
    proSuccess: proResult.success,
    adminSuccess,
    errors,
  };
}

/**
 * Send invoice email to customer with link to view invoice.
 */
export async function sendInvoiceEmail(
  data: InvoiceEmailData,
  toEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();
    const html = generateInvoiceEmail(data);
    const { data: res, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Invoice #${data.invoiceNumber} from ${data.businessName}`,
      html,
    });
    if (error) {
      logger.error('Failed to send invoice email', { toEmail, error: error.message }, error as Error);
      return { success: false, error: error.message };
    }
    logger.info('Invoice email sent', { toEmail, emailId: res?.id });
    return { success: true };
  } catch (err) {
    logger.error('Error sending invoice email', { toEmail }, err as Error);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Send estimate review email to customer with link to review/approve estimate.
 */
export async function sendEstimateReviewEmail(
  data: EstimateReviewEmailData,
  toEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();
    const html = generateEstimateReviewEmail(data);
    const { data: res, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Estimate #${data.estimateNumber} from ${data.businessName}`,
      html,
    });
    if (error) {
      logger.error('Failed to send estimate review email', { toEmail, error: error.message }, error as Error);
      return { success: false, error: error.message };
    }
    logger.info('Estimate review email sent', { toEmail, emailId: res?.id });
    return { success: true };
  } catch (err) {
    logger.error('Error sending estimate review email', { toEmail }, err as Error);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export interface SendEstimateApprovalEmailsPayload extends EstimateApprovedEmailCommon {
  customerEmail: string | null;
  /** Contractor account email and/or business inbox — at least one should be set when possible */
  contractorEmail: string | null;
}

/**
 * After a customer approves an estimate via the public link: notify customer, contractor, and platform admin.
 * Failures are logged; each channel is independent.
 */
export async function sendEstimateApprovalNotificationEmails(
  payload: SendEstimateApprovalEmailsPayload
): Promise<{ customer: boolean; contractor: boolean; admin: boolean }> {
  const common: EstimateApprovedEmailCommon = {
    businessName: payload.businessName,
    estimateNumber: payload.estimateNumber,
    amountCents: payload.amountCents,
    customerName: payload.customerName,
  };

  const results = { customer: false, contractor: false, admin: false };

  try {
    const resend = getResendClient();
    const fromEmail = getResendFromEmail();

    if (payload.customerEmail) {
      const html = generateEstimateApprovedCustomerEmail(common);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: payload.customerEmail,
        subject: `Estimate #${payload.estimateNumber} approved — thank you`,
        html,
      });
      if (error) {
        logger.error('Estimate approval email (customer) failed', { error: error.message }, error as Error);
      } else {
        results.customer = true;
        logger.info('Estimate approval email sent to customer', { to: payload.customerEmail });
      }
    }

    const contractorTo = payload.contractorEmail;
    if (contractorTo) {
      const html = generateEstimateApprovedContractorEmail(common);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: contractorTo,
        subject: `Estimate #${payload.estimateNumber} approved by ${payload.customerName}`,
        html,
      });
      if (error) {
        logger.error('Estimate approval email (contractor) failed', { error: error.message }, error as Error);
      } else {
        results.contractor = true;
        logger.info('Estimate approval email sent to contractor', { to: contractorTo });
      }
    }

    if (ADMIN_EMAIL && ADMIN_EMAIL !== '__CLIENT_SIDE_PLACEHOLDER__') {
      const adminHtml = generateEstimateApprovedAdminEmail({
        ...common,
        customerEmail: payload.customerEmail ?? '—',
      });
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: ADMIN_EMAIL,
        subject: `[${COMPANY_INFO.name}] Estimate #${payload.estimateNumber} accepted`,
        html: adminHtml,
      });
      if (error) {
        logger.error('Estimate approval email (admin) failed', { error: error.message }, error as Error);
      } else {
        results.admin = true;
        logger.info('Estimate approval email sent to admin', { to: ADMIN_EMAIL });
      }
    }
  } catch (err) {
    logger.error('sendEstimateApprovalNotificationEmails', {}, err as Error);
  }

  return results;
}

