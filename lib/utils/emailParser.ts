/**
 * Email parsing utilities for incoming webhook emails
 * Handles parsing of email data from Resend Inbound webhooks
 */

export interface ParsedEmail {
  messageId: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject?: string;
  textContent?: string;
  htmlContent?: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    url?: string;
    size?: number;
  }>;
  headers?: Record<string, string | string[]>;
}

/**
 * Parse email data from Resend Inbound webhook payload
 * 
 * Resend Inbound webhook format:
 * {
 *   "type": "email.received",
 *   "created_at": "2024-01-01T00:00:00.000Z",
 *   "data": {
 *     "from": "sender@example.com",
 *     "to": ["recipient@example.com"],
 *     "subject": "Subject",
 *     "text": "Plain text content",
 *     "html": "<html>...</html>",
 *     "headers": {...},
 *     "attachments": [...]
 *   }
 * }
 */
export function parseResendWebhook(payload: unknown): ParsedEmail | null {
  try {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    
    // Check if this is a Resend webhook
    if (data.type !== 'email.received') {
      return null;
    }

    const emailData = data.data as Record<string, unknown>;
    if (!emailData) {
      return null;
    }

    // Parse from field (can be string or object with name/email)
    let fromEmail = '';
    let fromName: string | undefined;
    
    if (typeof emailData.from === 'string') {
      fromEmail = emailData.from;
    } else if (emailData.from && typeof emailData.from === 'object') {
      const fromObj = emailData.from as Record<string, unknown>;
      fromEmail = (fromObj.email as string) || '';
      fromName = (fromObj.name as string) || undefined;
    }

    // Parse to field (can be string or array)
    let toEmail = '';
    if (Array.isArray(emailData.to)) {
      toEmail = (emailData.to[0] as string) || '';
    } else if (typeof emailData.to === 'string') {
      toEmail = emailData.to;
    }

    // Parse attachments
    let attachments: ParsedEmail['attachments'] = [];
    if (Array.isArray(emailData.attachments)) {
      attachments = emailData.attachments.map((att: unknown) => {
        if (att && typeof att === 'object') {
          const attObj = att as Record<string, unknown>;
          return {
            filename: (attObj.filename as string) || 'unknown',
            content_type: (attObj.content_type as string) || 'application/octet-stream',
            url: (attObj.url as string) || undefined,
            size: (attObj.size as number) || undefined,
          };
        }
        return null;
      }).filter((att): att is NonNullable<typeof att> => att !== null);
    }

    // Parse headers
    let headers: Record<string, string | string[]> = {};
    if (emailData.headers && typeof emailData.headers === 'object') {
      headers = emailData.headers as Record<string, string | string[]>;
    }

    // Get message ID (use Resend's record ID or generate from headers)
    const messageId = 
      (emailData.record_id as string) ||
      (headers['message-id'] as string) ||
      (headers['Message-ID'] as string) ||
      `resend_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      messageId,
      fromEmail: fromEmail.trim().toLowerCase(),
      fromName: fromName?.trim(),
      toEmail: toEmail.trim().toLowerCase(),
      subject: (emailData.subject as string) || undefined,
      textContent: (emailData.text as string) || undefined,
      htmlContent: (emailData.html as string) || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };
  } catch (error) {
    console.error('Error parsing Resend webhook:', error);
    return null;
  }
}

/**
 * Extract plain text from HTML content
 * Simple implementation - can be enhanced with a proper HTML parser
 */
export function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Replace common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Validate that an email address matches expected format
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email is from a known user in the system
 * Returns user ID if found, null otherwise
 */
export async function findUserByEmail(
  email: string,
  supabase: ReturnType<typeof import('@/lib/supabase/server').createServiceRoleClient>
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  } catch {
    return null;
  }
}
