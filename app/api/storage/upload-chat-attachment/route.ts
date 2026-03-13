import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import {
  validateChatAttachmentMagicBytes,
  getExtensionFromMimeType,
  MAX_FILE_SIZES,
} from '@/lib/utils/fileValidation';
import { z } from 'zod';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

const MAX_ATTACHMENTS_PER_REQUEST = 10;
const BUCKET = 'chat-attachments';

const conversationIdSchema = z.string().uuid();
const visitorIdSchema = z.string().trim().min(1).max(100);

/**
 * POST /api/storage/upload-chat-attachment
 * Upload one or more chat attachments (images or PDF). Max 10 files, 10MB each.
 * Returns [{ url, name, contentType }].
 * Path is derived from server-validated conversation ownership (visitor or admin/contractor with access).
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const rateLimitRes = await checkRateLimit(request, 'upload', user?.id);
    if (rateLimitRes) return rateLimitRes;

    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    const flat = files.flatMap((f) => (f instanceof File ? [f] : []));
    if (flat.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    if (flat.length > MAX_ATTACHMENTS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ATTACHMENTS_PER_REQUEST} files per upload` },
        { status: 400 }
      );
    }

    const rawConversationId = (formData.get('conversationId') as string)?.trim() ?? '';
    const rawVisitorId = (formData.get('visitorId') as string)?.trim() ?? '';
    const supabase = createServiceRoleClient();

    let prefix: string;
    if (!user) {
      const convId = conversationIdSchema.safeParse(rawConversationId);
      const visId = visitorIdSchema.safeParse(rawVisitorId);
      if (!convId.success || !visId.success) {
        return NextResponse.json({ error: 'conversationId and visitorId are required for upload' }, { status: 400 });
      }
      const { data: conv } = await supabase
        .from('probot_conversations')
        .select('id')
        .eq('id', convId.data)
        .eq('visitor_id', visId.data)
        .single();
      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
      }
      prefix = `${convId.data}/${visId.data}`;
    } else {
      const convId = conversationIdSchema.safeParse(rawConversationId);
      if (!convId.success) {
        return NextResponse.json({ error: 'Valid conversationId is required' }, { status: 400 });
      }
      const { data: conv } = await supabase
        .from('probot_conversations')
        .select('id, visitor_id')
        .eq('id', convId.data)
        .single();
      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      const isAdmin = user.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if (isAdmin) {
        prefix = `${convId.data}/admin-${user.id}`;
      } else {
        const { data: profile } = await supabaseAuth
          .from('profiles')
          .select('business_id')
          .eq('id', user.id)
          .single();
        const businessId = (profile as { business_id?: string } | null)?.business_id ?? null;
        if (!businessId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { data: msgRow } = await supabase
          .from('probot_messages')
          .select('id')
          .eq('conversation_id', convId.data)
          .eq('business_id', businessId)
          .limit(1)
          .maybeSingle();
        const convVisitorId = (conv as { visitor_id?: string }).visitor_id;
        const hasMessage = !!msgRow;
        const isOwnThread =
          convVisitorId &&
          rawVisitorId &&
          convVisitorId.trim() === rawVisitorId.trim();
        if (!hasMessage && !isOwnThread) {
          return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
        }
        prefix = `${convId.data}/contractor-${user.id}`;
      }
    }

    const results: { url: string; name: string; contentType: string }[] = [];

    for (const file of flat) {
      if (file.size > MAX_FILE_SIZES.chat) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 10MB limit` },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const validation = await validateChatAttachmentMagicBytes(buffer);
      if (!validation.isValid || !validation.mimeType) {
        const allowed = 'JPEG, PNG, WebP, PDF';
        const hint =
          file.name.toLowerCase().endsWith('.pdf')
            ? ' PDFs must be under 10MB and start with %PDF.'
            : '';
        return NextResponse.json(
          { error: `Invalid file type for "${file.name}". Allowed: ${allowed}.${hint}` },
          { status: 400 }
        );
      }
      const ext = getExtensionFromMimeType(validation.mimeType);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
      const filePath = `${prefix}/${Date.now()}-${safeName}${ext}`;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
          cacheControl: '86400',
          upsert: false,
          contentType: validation.mimeType,
        });

      if (error) {
        console.error('Chat attachment upload error:', error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      results.push({
        url: publicUrl,
        name: file.name,
        contentType: validation.mimeType,
      });
    }

    return NextResponse.json({ attachments: results }, { status: 200 });
  } catch (e) {
    console.error('Upload chat attachment error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
