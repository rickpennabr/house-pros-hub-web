# Incoming Email Setup Guide

This guide explains how to set up incoming email handling for `legal@houseproshub.com` and other configured email addresses.

## Overview

The system now supports receiving and processing incoming emails via webhooks from Resend Inbound. When someone emails `legal@houseproshub.com`, `contact@houseproshub.com`, or `privacy@houseproshub.com`, the email is:

1. Received by Resend Inbound
2. Forwarded to our webhook endpoint
3. Parsed and stored in the database
4. **Forwarded to the site admin** (the email configured in `ADMIN_EMAIL`) so you receive all inbound emails in one inbox
5. Available for further processing (auto-responses, etc.)

## Architecture

```
Email → Resend Inbound → Webhook → /api/webhooks/email → Database
```

### Components

- **Database Table**: `incoming_emails` - Stores all received emails
- **Webhook Endpoint**: `/api/webhooks/email` - Receives webhook events from Resend
- **Email Parser**: `lib/utils/emailParser.ts` - Parses Resend webhook payloads
- **Email Service**: `lib/services/incomingEmailService.ts` - Handles storage and retrieval
- **Webhook Auth**: `lib/utils/webhookAuth.ts` - Validates webhook requests

## Setup Instructions

### 1. Configure Resend Inbound

1. **Log in to Resend Dashboard**
   - Go to https://resend.com
   - Navigate to **Domains** → **Inbound**

2. **Add Inbound Domain**
   - Add your domain (e.g., `houseproshub.com`)
   - Follow DNS configuration instructions to add MX records
   - Wait for domain verification

3. **Configure Webhook**
   - Go to **Webhooks** in Resend dashboard
   - Create a new webhook
   - Set webhook URL to: `https://yourdomain.com/api/webhooks/email`
   - Select event type: `email.received`
   - Copy the webhook secret (you'll need this for step 2)

### 2. Configure Environment Variables

Add the following to your `.env.local` (development) and production environment:

```bash
# Resend Webhook Secret (from Resend dashboard)
RESEND_WEBHOOK_SECRET=your_webhook_secret_here

# OR use API key authentication (alternative)
WEBHOOK_API_KEY=your_secure_api_key_here

# Existing Resend configuration (should already be set)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@houseproshub.com
```

**Security Note**: 
- In production, `RESEND_WEBHOOK_SECRET` or `WEBHOOK_API_KEY` is **required**
- In development, webhooks will work without authentication (for testing)

### 3. Run Database Migration

The migration `012_create_incoming_emails_table.sql` creates the necessary database table:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually via Supabase dashboard
```

### 4. Test the Setup

1. **Test Webhook Endpoint**
   ```bash
   curl https://yourdomain.com/api/webhooks/email
   ```
   Should return: `{"status":"ok","message":"Email webhook endpoint is active"}`

2. **Send Test Email**
   - Send an email to `legal@houseproshub.com`
   - Check the database `incoming_emails` table for the new record
   - Check application logs for processing confirmation

3. **Verify in Database**
   ```sql
   SELECT * FROM incoming_emails 
   ORDER BY received_at DESC 
   LIMIT 10;
   ```

## Database Schema

### `incoming_emails` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `message_id` | TEXT | Unique message ID (prevents duplicates) |
| `from_email` | TEXT | Sender email address |
| `from_name` | TEXT | Sender name (optional) |
| `to_email` | TEXT | Recipient email (e.g., legal@houseproshub.com) |
| `subject` | TEXT | Email subject |
| `text_content` | TEXT | Plain text email body |
| `html_content` | TEXT | HTML email body |
| `attachments` | JSONB | Array of attachment metadata |
| `headers` | JSONB | Email headers |
| `status` | TEXT | Processing status: `new`, `processing`, `processed`, `failed`, `archived` |
| `user_id` | UUID | Linked user ID if sender is a registered user |
| `received_at` | TIMESTAMP | When email was received |
| `processed_at` | TIMESTAMP | When email was processed |
| `error_message` | TEXT | Error message if processing failed |

## API Endpoints

### POST `/api/webhooks/email`

Receives webhook events from Resend Inbound.

**Authentication**: 
- Resend webhook signature (via `RESEND_WEBHOOK_SECRET`)
- OR API key (via `WEBHOOK_API_KEY` header)

**Request Body**: Resend webhook payload
```json
{
  "type": "email.received",
  "data": {
    "from": "sender@example.com",
    "to": ["legal@houseproshub.com"],
    "subject": "Legal inquiry",
    "text": "Plain text content",
    "html": "<html>...</html>",
    "headers": {...},
    "attachments": [...]
  }
}
```

**Response**: 
```json
{
  "success": true,
  "message": "Email received and processed",
  "emailId": "uuid-here"
}
```

### GET `/api/webhooks/email`

Health check endpoint. Returns webhook status and configured email addresses.

## Admin Email (ADMIN_EMAIL)

The **site admin email** is configured via the `ADMIN_EMAIL` environment variable. This is the same email used for admin dashboard access. All incoming emails to `legal@houseproshub.com`, `contact@houseproshub.com`, and `privacy@houseproshub.com` are forwarded to this address as notification emails, so you receive everything in one inbox. Set it in `.env.local` and production:

```bash
ADMIN_EMAIL=your-admin@houseproshub.com
```

## Processing Emails

Emails are stored in the database with status `new` → `processing` → `processed`. Each incoming email triggers a notification email to `ADMIN_EMAIL` with the full message content and reply-to set to the original sender.

### Future Enhancements

You can extend the processing in `app/api/webhooks/email/route.ts`:

1. **Send Notifications**
   ```typescript
   // Notify admins via email/Slack/Discord
   await notifyAdmins(parsedEmail);
   ```

2. **Auto-Response**
   ```typescript
   // Send automatic acknowledgment
   await sendAutoResponse(parsedEmail);
   ```

3. **Create Support Tickets**
   ```typescript
   // Create ticket in support system
   await createSupportTicket(parsedEmail);
   ```

4. **Route to Team Members**
   ```typescript
   // Route based on email content or sender
   await routeToTeamMember(parsedEmail);
   ```

## Querying Incoming Emails

### Get emails for a specific address

```typescript
import { getIncomingEmails } from '@/lib/services/incomingEmailService';

const result = await getIncomingEmails('legal@houseproshub.com', 50, 0);
if (result.success && result.emails) {
  // Process emails
}
```

### Direct database query

```sql
-- Get recent emails for legal address
SELECT 
  id,
  from_email,
  from_name,
  subject,
  status,
  received_at
FROM incoming_emails
WHERE to_email = 'legal@houseproshub.com'
ORDER BY received_at DESC
LIMIT 50;

-- Get unprocessed emails
SELECT * FROM incoming_emails
WHERE status = 'new'
ORDER BY received_at ASC;

-- Get emails from a specific user
SELECT * FROM incoming_emails
WHERE user_id = 'user-uuid-here'
ORDER BY received_at DESC;
```

## Security Considerations

1. **Webhook Authentication**: Always configure `RESEND_WEBHOOK_SECRET` or `WEBHOOK_API_KEY` in production
2. **Rate Limiting**: Consider adding rate limiting for webhook endpoint
3. **IP Whitelisting**: Optionally restrict webhook endpoint to Resend IPs
4. **Data Privacy**: Email content may contain sensitive information - ensure proper access controls
5. **RLS Policies**: The `incoming_emails` table has RLS enabled - adjust policies as needed

## Troubleshooting

### Incoming emails not in Supabase or admin inbox (contact@ / legal@)

If you send to `contact@houseproshub.com` or `legal@houseproshub.com` but nothing appears in the `incoming_emails` table or in your admin email, work through these checks in order.

#### 1. Mail must be received by Resend, not only forwarded by GoDaddy

**Critical:** The app only sees mail when **Resend Inbound** receives it and calls your webhook. If you only set up **GoDaddy email forwarding** to Gmail, mail goes to Gmail only—Resend never sees it, so no webhook is fired and nothing is stored.

- **Option A – Use Resend Inbound (recommended for the app):**
  - In [Resend Dashboard](https://resend.com) go to **Domains** → **Inbound** (or **Receiving**).
  - Add your domain (e.g. `houseproshub.com`). Resend may recommend a subdomain (e.g. `mail.houseproshub.com`) to avoid clashing with existing MX.
  - Add the **MX records** Resend gives you at your DNS provider (GoDaddy). Those MX records must point to Resend’s servers so Resend receives mail for `contact@`, `legal@`, etc.
  - After that, you do **not** need GoDaddy forwarding for those addresses—the app will store the email and send a notification to `ADMIN_EMAIL` (you can set `ADMIN_EMAIL=rick.maickcompanies@gmail.com`).
- **Option B – GoDaddy forwarding only:**
  - Mail goes to Gmail only. The app and Supabase never see it. To have rows in `incoming_emails` and admin notifications, you must use Option A.

#### 2. Resend Inbound and webhook configuration

- **Resend Dashboard → Domains / Inbound**
  - Domain (or subdomain) added and **verified** (DNS propagated).
  - Inbound is enabled for that domain.
- **Resend Dashboard → Webhooks**
  - Webhook URL: `https://your-production-domain.com/api/webhooks/email` (must be HTTPS and reachable from the internet).
  - Event: **`email.received`**.
  - Copy the **Signing secret** (or use an API key) for the next step.

#### 3. Environment variables (production)

In your deployment (e.g. Vercel) and in `.env.local` for local testing:

```bash
# One of these is required in production so the webhook is accepted:
RESEND_WEBHOOK_SECRET=<signing_secret_from_Resend_webhook>
# OR
WEBHOOK_API_KEY=<your_secure_random_string>

# So you receive the notification email and can use admin features:
ADMIN_EMAIL=rick.maickcompanies@gmail.com
```

- If `RESEND_WEBHOOK_SECRET` and `WEBHOOK_API_KEY` are both missing in **production**, the webhook returns 401 and Resend may retry; nothing is stored.
- Our webhook auth accepts either Resend’s secret (e.g. via `x-resend-signature` / `x-resend-api-key`) or `Authorization: Bearer <WEBHOOK_API_KEY>` / `x-api-key: <WEBHOOK_API_KEY>`.

#### 4. Webhook endpoint and logs

- **Health check:**  
  `GET https://your-production-domain.com/api/webhooks/email`  
  Should return something like:  
  `{"status":"ok","message":"Email webhook endpoint is active","configuredEmails":["contact@houseproshub.com","legal@houseproshub.com","privacy@houseproshub.com"]}`

- **Resend Dashboard:**  
  In Webhooks, open your webhook and check **Recent deliveries**. See if requests are sent and whether the response is 200 or 4xx/5xx.

- **Application logs:**  
  Look for:
  - `Unauthorized webhook request` → fix `RESEND_WEBHOOK_SECRET` or `WEBHOOK_API_KEY`.
  - `Failed to parse webhook payload` / `Invalid webhook payload` → Resend’s payload format may differ; check `lib/utils/emailParser.ts` and Resend’s [webhook body docs](https://resend.com/docs/dashboard/webhooks/body-parameters).
  - `Failed to store incoming email` → see step 5 (Supabase).

#### 5. Supabase and `incoming_emails` table

- **Table exists:**  
  Run the migration that creates `incoming_emails` (e.g. `012_create_incoming_emails_table.sql`) if you haven’t already.

- **Service role:**  
  The webhook uses `createServiceRoleClient()` to insert into `incoming_emails`. The Supabase project’s **service_role** key must be set in the app (e.g. `SUPABASE_SERVICE_ROLE_KEY`). RLS does not apply to the service role, so inserts should succeed if the table and key are correct.

- **Unique constraint:**  
  Inserts use `message_id`. If Resend sends the same event twice, the second insert can fail on the unique constraint; the code treats that as success (duplicate). So missing rows are not usually due to duplicates.

#### 6. Admin notification email

- **ADMIN_EMAIL** must be set so `sendIncomingEmailNotification()` sends the notification to you.
- **RESEND_API_KEY** and **RESEND_FROM_EMAIL** must be set for the app to send that email (same Resend account is fine). Check Resend dashboard and outbound sending if you don’t receive the admin notification.

#### Quick checklist

| Check | What to verify |
|-------|----------------|
| MX records | Point to Resend’s inbound servers for the domain (or subdomain) you use in Resend Inbound. |
| Resend Inbound | Domain verified; inbound enabled. |
| Resend Webhook | URL = `https://<your-domain>/api/webhooks/email`, event = `email.received`. |
| Auth | `RESEND_WEBHOOK_SECRET` or `WEBHOOK_API_KEY` set in production. |
| ADMIN_EMAIL | Set to the inbox where you want notifications (e.g. Gmail). |
| Supabase | `incoming_emails` migration applied; `SUPABASE_SERVICE_ROLE_KEY` set. |
| Resend deliveries | Webhook “Recent deliveries” show 200 and no errors. |

---

### Emails not being received (general)

1. **Check DNS Configuration**
   - Verify MX records point to **Resend** (for Inbound), not only to GoDaddy or Gmail
   - Use `dig MX houseproshub.com` to see where mail is delivered

2. **Check Webhook Configuration**
   - Verify webhook URL is correct in Resend dashboard
   - Test webhook endpoint: `GET /api/webhooks/email`

3. **Check Logs**
   - Look for errors in application logs
   - Check for authentication failures

4. **Check Database**
   - Verify migration was applied
   - Check if emails are being stored but not processed

### Duplicate emails

The system prevents duplicates using `message_id`. If you see duplicates:
- Check if `message_id` is being set correctly
- Verify database unique constraint on `message_id`

### Authentication failures

- Verify `RESEND_WEBHOOK_SECRET` or `WEBHOOK_API_KEY` is set correctly
- Check webhook signature in request headers
- In development, authentication is more lenient - check production logs

## Support

For issues or questions:
- Check Resend documentation: https://resend.com/docs
- Review application logs
- Check database for stored emails
- Test webhook endpoint manually
