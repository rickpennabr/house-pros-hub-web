import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/blog/admin';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { listPlantCorrections } from '@/lib/ai/plant-corrections';
import { parseAgentPayload } from '@/lib/chat/proagent-policy';
import { isAllowedChatAttachmentUrl } from '@/lib/utils/chatAttachmentAllowlist';
import type { Json } from '@/lib/types/supabase';

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** GET /api/admin/plant-corrections: every correction, newest first. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    return NextResponse.json({ corrections: await listPlantCorrections() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load';
    const missing = /ai_plant_corrections/.test(message);
    return NextResponse.json(
      { error: missing ? 'Apply migration 149 (plant ID corrections) first.' : message },
      { status: missing ? 503 : 500 }
    );
  }
}

/**
 * POST /api/admin/plant-corrections
 * { messageId, correctCommonName, correctScientificName?, notes?, postInChat? } from a ProBot plant
 * answer, or { photoUrl, wrongCommonName?, correctCommonName, … } for any chat photo.
 * Every later identification uses it. With postInChat, ProBot posts the correction in that chat.
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin();
  if (error || !user) return error!;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const correctCommonName = text(body.correctCommonName, 120);
    const correctScientificName = text(body.correctScientificName, 120) || null;
    const notes = text(body.notes, 600) || null;
    if (!correctCommonName) return NextResponse.json({ error: 'Enter the correct plant name.' }, { status: 400 });

    const admin = createServiceRoleClient();
    let photoUrl = text(body.photoUrl, 1000);
    let wrongCommonName = text(body.wrongCommonName, 120) || null;
    let wrongScientificName = text(body.wrongScientificName, 120) || null;
    let message: { id: string; conversation_id: string; payload: unknown } | null = null;

    const messageId = text(body.messageId, 64);
    if (messageId) {
      const { data } = await admin
        .from('probot_messages')
        .select('id, conversation_id, payload')
        .eq('id', messageId)
        .maybeSingle();
      const plant = parseAgentPayload(data?.payload)?.plantId;
      if (!data || !plant) return NextResponse.json({ error: 'That message has no plant identification.' }, { status: 404 });
      message = data;
      photoUrl = plant.photoUrl;
      wrongCommonName = plant.commonName || null;
      wrongScientificName = plant.scientificName || null;
    }
    if (!photoUrl || !isAllowedChatAttachmentUrl(photoUrl)) {
      return NextResponse.json({ error: 'The photo must be one sent in the chat.' }, { status: 400 });
    }

    const { data: saved, error: insertError } = await admin
      .from('ai_plant_corrections')
      .insert({
        created_by: user.id,
        photo_url: photoUrl,
        wrong_common_name: wrongCommonName,
        wrong_scientific_name: wrongScientificName,
        correct_common_name: correctCommonName,
        correct_scientific_name: correctScientificName,
        notes,
        source_message_id: message?.id ?? null,
      })
      .select('id')
      .single();
    if (insertError || !saved) {
      const missing = /ai_plant_corrections/.test(insertError?.message ?? '');
      return NextResponse.json(
        { error: missing ? 'Apply migration 149 (plant ID corrections) first.' : insertError?.message || 'Could not save' },
        { status: missing ? 503 : 500 }
      );
    }

    const correctedTo = [correctCommonName, correctScientificName && `(${correctScientificName})`].filter(Boolean).join(' ');
    let posted: unknown = null;
    if (message) {
      const payload = (message.payload && typeof message.payload === 'object' ? message.payload : {}) as Record<string, unknown>;
      const plantId = (payload.plantId ?? {}) as Record<string, unknown>;
      await admin
        .from('probot_messages')
        .update({ payload: { ...payload, plantId: { ...plantId, correctedTo } } as Json })
        .eq('id', message.id);

      if (body.postInChat !== false) {
        const lines = [
          `Correction: this plant is **${correctCommonName}**${correctScientificName ? ` (*${correctScientificName}*)` : ''}${wrongCommonName ? `, not ${wrongCommonName}` : ''}.`,
          notes ? `- **How to tell:** ${notes}` : '',
          'Thanks for your patience. I will remember this for next time.',
        ].filter(Boolean);
        const { data: reply } = await admin
          .from('probot_messages')
          .insert({
            conversation_id: message.conversation_id,
            sender: 'admin',
            body: lines.join('\n'),
            admin_sent_as: 'probot',
          })
          .select('id, conversation_id, sender, body, created_at, payload')
          .single();
        posted = reply;
      }
    }

    return NextResponse.json({ id: saved.id, correctedTo, posted }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/plant-corrections', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
