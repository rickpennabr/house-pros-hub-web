/**
 * Service for processing and storing incoming emails
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { ParsedEmail } from '@/lib/utils/emailParser';
import { findUserByEmail } from '@/lib/utils/emailParser';

export interface IncomingEmailRecord {
  id: string;
  message_id: string;
  from_email: string;
  from_name?: string;
  to_email: string;
  subject?: string;
  text_content?: string;
  html_content?: string;
  attachments?: unknown;
  headers?: unknown;
  status: 'new' | 'processing' | 'processed' | 'failed' | 'archived';
  user_id?: string;
  received_at: string;
}

/**
 * Store incoming email in database
 */
export async function storeIncomingEmail(
  parsedEmail: ParsedEmail
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const supabase = createServiceRoleClient();

  try {
    // Check if email with this message ID already exists (prevent duplicates)
    const { data: existing } = await supabase
      .from('incoming_emails')
      .select('id')
      .eq('message_id', parsedEmail.messageId)
      .single();

    if (existing) {
      logger.warn('Duplicate email received', {
        endpoint: 'incoming-email-service',
        messageId: parsedEmail.messageId,
        toEmail: parsedEmail.toEmail,
      });
      return {
        success: true,
        emailId: existing.id,
      };
    }

    // Try to find user by email
    let userId: string | null = null;
    try {
      userId = await findUserByEmail(parsedEmail.fromEmail, supabase);
    } catch (error) {
      logger.debug('Could not find user by email', {
        endpoint: 'incoming-email-service',
        fromEmail: parsedEmail.fromEmail,
      });
    }

    // Insert email record
    const { data, error } = await supabase
      .from('incoming_emails')
      .insert({
        message_id: parsedEmail.messageId,
        from_email: parsedEmail.fromEmail,
        from_name: parsedEmail.fromName || null,
        to_email: parsedEmail.toEmail,
        subject: parsedEmail.subject || null,
        text_content: parsedEmail.textContent || null,
        html_content: parsedEmail.htmlContent || null,
        attachments: parsedEmail.attachments || null,
        headers: parsedEmail.headers || null,
        status: 'new',
        user_id: userId,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to store incoming email', {
        endpoint: 'incoming-email-service',
        messageId: parsedEmail.messageId,
        error: error.message,
      }, error as Error);
      return {
        success: false,
        error: error.message,
      };
    }

    logger.info('Incoming email stored successfully', {
      endpoint: 'incoming-email-service',
      emailId: data.id,
      messageId: parsedEmail.messageId,
      toEmail: parsedEmail.toEmail,
      fromEmail: parsedEmail.fromEmail,
    });

    return {
      success: true,
      emailId: data.id,
    };
  } catch (error) {
    logger.error('Error storing incoming email', {
      endpoint: 'incoming-email-service',
      messageId: parsedEmail.messageId,
    }, error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update email processing status
 */
export async function updateEmailStatus(
  emailId: string,
  status: IncomingEmailRecord['status'],
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  try {
    const updateData: {
      status: IncomingEmailRecord['status'];
      processed_at?: string;
      error_message?: string;
    } = {
      status,
    };

    if (status === 'processed' || status === 'failed') {
      updateData.processed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('incoming_emails')
      .update(updateData)
      .eq('id', emailId);

    if (error) {
      logger.error('Failed to update email status', {
        endpoint: 'incoming-email-service',
        emailId,
        status,
        error: error.message,
      }, error as Error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    logger.error('Error updating email status', {
      endpoint: 'incoming-email-service',
      emailId,
      status,
    }, error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get incoming emails by recipient
 */
export async function getIncomingEmails(
  toEmail: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; emails?: IncomingEmailRecord[]; error?: string }> {
  const supabase = createServiceRoleClient();

  try {
    const { data, error } = await supabase
      .from('incoming_emails')
      .select('*')
      .eq('to_email', toEmail.toLowerCase().trim())
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to get incoming emails', {
        endpoint: 'incoming-email-service',
        toEmail,
        error: error.message,
      }, error as Error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      emails: data as IncomingEmailRecord[],
    };
  } catch (error) {
    logger.error('Error getting incoming emails', {
      endpoint: 'incoming-email-service',
      toEmail,
    }, error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
