import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { CrmDb } from '@/lib/crm/crm-scope';
import type { Json } from '@/lib/types/supabase';
import type { ChatProbotFollowup } from '@/lib/types/chat';

const bodySchema = z.object({
  /** sent: the pro sent the reminder or follow-up (the card already called the send endpoint). */
  action: z.enum(['sent', 'snooze', 'done']),
  days: z.number().int().min(1).max(30).optional(),
});

function addDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** POST /api/crm/probot/followups/[id] { action } — the pro's answer on a ProBot follow-up card. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError, user } = await requireContractor();
  if (authError || !user) return authError!;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid card' }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const admin = createServiceRoleClient();
  const db = admin as unknown as CrmDb;
  const { data: row } = await db.from('probot_followups').select('id, owner_id, message_id').eq('id', id).maybeSingle();
  const card = row as { id: string; owner_id: string; message_id: string | null } | null;
  if (!card || card.owner_id !== user.id) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const now = new Date().toISOString();
  const snoozedUntil = parsed.data.action === 'snooze' ? addDays(parsed.data.days ?? 3) : null;
  const status: ChatProbotFollowup['status'] = parsed.data.action === 'snooze' ? 'snoozed' : parsed.data.action;
  const { error } = await db
    .from('probot_followups')
    .update({ status, snoozed_until: snoozedUntil, acted_at: parsed.data.action === 'snooze' ? null : now })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the chat card in step, so it reads the same after a reload.
  if (card.message_id) {
    const { data: message } = await admin.from('probot_messages').select('payload').eq('id', card.message_id).maybeSingle();
    const payload = (message?.payload && typeof message.payload === 'object' && !Array.isArray(message.payload) ? message.payload : {}) as Record<string, unknown>;
    const current = (payload.followup && typeof payload.followup === 'object' ? payload.followup : {}) as Record<string, unknown>;
    await admin
      .from('probot_messages')
      .update({
        payload: {
          ...payload,
          followup: { ...current, status, ...(snoozedUntil ? { snoozedUntil } : {}), ...(status !== 'snoozed' ? { actedAt: now } : {}) },
        } as unknown as Json,
      })
      .eq('id', card.message_id);
  }
  return NextResponse.json({ status, snoozedUntil, actedAt: status === 'snoozed' ? null : now });
}
