/**
 * POST /api/webhooks/email
 * Webhook endpoint for receiving incoming emails from Resend Inbound
 * 
 * This endpoint receives webhook events when emails are sent to configured
 * inbound email addresses (e.g., legal@houseproshub.com).
 * 
 * Setup:
 * 1. Configure Resend Inbound for your domain
 * 2. Set webhook URL to: https://yourdomain.com/api/webhooks/email
 * 3. Configure RESEND_WEBHOOK_SECRET or WEBHOOK_API_KEY environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyResendWebhook, verifyWebhookApiKey } from '@/lib/utils/webhookAuth';
import { parseResendWebhook } from '@/lib/utils/emailParser';
import { storeIncomingEmail, updateEmailStatus } from '@/lib/services/incomingEmailService';
import { sendIncomingEmailNotification } from '@/lib/services/emailService';
import { logger } from '@/lib/utils/logger';
import { handleError } from '@/lib/utils/errorHandler';
import { COMPANY_INFO } from '@/lib/constants/company';

/**
 * POST /api/webhooks/email
 * Handle incoming email webhook from Resend
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook authentication
    const isAuthenticated = verifyResendWebhook(request) || verifyWebhookApiKey(request);
    
    if (!isAuthenticated) {
      logger.warn('Unauthorized webhook request', {
        endpoint: '/api/webhooks/email',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    let payload: unknown;
    try {
      payload = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in webhook request', {
        endpoint: '/api/webhooks/email',
      }, error as Error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Parse email from webhook payload
    const parsedEmail = parseResendWebhook(payload);
    
    if (!parsedEmail) {
      logger.warn('Failed to parse webhook payload', {
        endpoint: '/api/webhooks/email',
        payloadType: typeof payload,
      });
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    // Validate that this is for a configured email address
    const allowedEmails = [
      COMPANY_INFO.email.contact,
      COMPANY_INFO.email.legal,
      COMPANY_INFO.email.privacy,
    ].map(email => email.toLowerCase().trim());

    if (!allowedEmails.includes(parsedEmail.toEmail)) {
      logger.warn('Email received for unconfigured address', {
        endpoint: '/api/webhooks/email',
        toEmail: parsedEmail.toEmail,
        allowedEmails,
      });
      // Still process it, but log the warning
    }

    // Store email in database
    const storeResult = await storeIncomingEmail(parsedEmail);
    
    if (!storeResult.success) {
      logger.error('Failed to store incoming email', {
        endpoint: '/api/webhooks/email',
        messageId: parsedEmail.messageId,
        error: storeResult.error,
      });
      
      // Return 500 so Resend will retry
      return NextResponse.json(
        { error: 'Failed to process email' },
        { status: 500 }
      );
    }

    // Mark as processing
    if (storeResult.emailId) {
      await updateEmailStatus(storeResult.emailId, 'processing');
    }

    // Send notification to admin
    const notificationResult = await sendIncomingEmailNotification(
      parsedEmail,
      storeResult.emailId
    );

    if (!notificationResult.success) {
      logger.warn('Failed to send admin notification for incoming email', {
        endpoint: '/api/webhooks/email',
        emailId: storeResult.emailId,
        error: notificationResult.error,
      });
    }

    // Mark as processed
    if (storeResult.emailId) {
      await updateEmailStatus(storeResult.emailId, 'processed');
    }

    logger.info('Incoming email processed successfully', {
      endpoint: '/api/webhooks/email',
      emailId: storeResult.emailId,
      messageId: parsedEmail.messageId,
      toEmail: parsedEmail.toEmail,
      fromEmail: parsedEmail.fromEmail,
    });

    // Return success to Resend
    return NextResponse.json(
      { 
        success: true,
        message: 'Email received and processed',
        emailId: storeResult.emailId,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error processing email webhook', {
      endpoint: '/api/webhooks/email',
    }, error as Error);
    return handleError(error, { endpoint: '/api/webhooks/email' });
  }
}

/**
 * GET /api/webhooks/email
 * Health check endpoint for webhook configuration
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      message: 'Email webhook endpoint is active',
      configuredEmails: [
        COMPANY_INFO.email.contact,
        COMPANY_INFO.email.legal,
        COMPANY_INFO.email.privacy,
      ],
    },
    { status: 200 }
  );
}
