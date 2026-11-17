import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth, type AuthenticatedRequest } from '@/lib/middleware/auth';
import {
  findInvitationCode,
  invitationCodeBlockReason,
  parseInvitationRole,
} from '@/lib/auth/invitationCodes';
import {
  isProAccountRole,
  primaryProAccountRole,
  roleRequiresInvitation,
} from '@/lib/utils/proAccountRole';
import { invalidateBusinessDirectoryCache } from '@/lib/data/businessDirectory';
import { sanitizeText } from '@/lib/utils/sanitize';
import {
  isValidNevadaRealtorLicenseNumber,
  normalizeNevadaRealtorLicenseNumber,
  nevadaRealtorLicenseHint,
} from '@/lib/utils/nevadaRealtorLicense';

const bodySchema = z.object({
  role: z.enum(['contractor', 'realtor', 'installer', 'handyman']),
  invitationCode: z.string().trim().optional(),
  /** Optional contractor license updates when upgrading. */
  licenses: z
    .array(
      z.object({
        license: z.string().trim().min(1),
        licenseNumber: z.string().trim().optional().default(''),
      })
    )
    .optional(),
  /** Optional realtor brokerage label saved onto the business name/description fields. */
  brokerageName: z.string().trim().optional(),
});

async function switchPrimaryRole(userId: string, role: string, isActive = true) {
  const service = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data: rows, error: lookupError } = await service
    .from('user_roles')
    .select('id, role, is_active')
    .eq('user_id', userId);
  if (lookupError) throw new Error(lookupError.message);

  const existing = (rows || []).find((row) => row.role === role);
  if (existing) {
    const { error } = await service
      .from('user_roles')
      .update({
        is_active: isActive,
        activated_at: isActive ? now : undefined,
        deactivated_at: isActive ? null : now,
      })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await service.from('user_roles').insert({
      user_id: userId,
      role,
      is_active: isActive,
      activated_at: isActive ? now : null,
      deactivated_at: isActive ? null : now,
    });
    if (error) throw new Error(error.message);
  }

  const otherIds = (rows || []).filter((row) => row.role !== role).map((row) => row.id);
  if (otherIds.length > 0) {
    const { error } = await service
      .from('user_roles')
      .update({ is_active: false, deactivated_at: now })
      .in('id', otherIds);
    if (error) throw new Error(error.message);
  }
}

async function handleSwitch(request: AuthenticatedRequest) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const raw = request._body || (await request.json().catch(() => ({})));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid role request' }, { status: 400 });
    }

    const { role, invitationCode, licenses, brokerageName } = parsed.data;
    if (!isProAccountRole(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const service = createServiceRoleClient();

    if (roleRequiresInvitation(role)) {
      const code = invitationCode?.trim().toUpperCase() || '';
      if (!code) {
        return NextResponse.json(
          { error: 'Invitation code required for contractor and realtor' },
          { status: 400 }
        );
      }
      const invitationRole = parseInvitationRole(role);
      const { row, error } = await findInvitationCode(service, invitationRole, code);
      const block = error ? 'Invalid or expired invitation code.' : invitationCodeBlockReason(row);
      if (block || !row) {
        return NextResponse.json({ error: block || 'Invalid invitation code' }, { status: 400 });
      }

      const { error: useError } = await service
        .from('invitation_codes')
        .update({
          used_at: new Date().toISOString(),
          used_by: userId,
        })
        .eq('id', row.id)
        .is('used_at', null);
      if (useError) {
        return NextResponse.json(
          { error: useError.message || 'Failed to redeem invitation code' },
          { status: 400 }
        );
      }
    }

    await switchPrimaryRole(userId, role, true);

    const { data: profile } = await service
      .from('profiles')
      .select('business_id')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.business_id) {
      if ((role === 'contractor' || role === 'realtor') && licenses && licenses.length > 0) {
        const normalizedLicenses = licenses.map((item) => {
          if (role !== 'realtor') return item;
          const normalized = normalizeNevadaRealtorLicenseNumber(item.licenseNumber || '');
          return { ...item, licenseNumber: normalized };
        });

        if (role === 'realtor') {
          for (const item of normalizedLicenses) {
            if (!isValidNevadaRealtorLicenseNumber(item.licenseNumber || '', item.license)) {
              return NextResponse.json(
                { error: nevadaRealtorLicenseHint(item.license) },
                { status: 400 }
              );
            }
          }
        }

        await service.from('licenses').delete().eq('business_id', profile.business_id);
        const { error: licenseError } = await service.from('licenses').insert(
          normalizedLicenses.map((item) => ({
            business_id: profile.business_id,
            license_type: sanitizeText(item.license) || item.license,
            license_number: item.licenseNumber
              ? sanitizeText(item.licenseNumber) || item.licenseNumber
              : null,
            license_name: null,
            is_active: true,
          }))
        );
        if (licenseError) {
          return NextResponse.json(
            { error: licenseError.message || 'Role updated but licenses failed to save' },
            { status: 400 }
          );
        }
      }

      if (role === 'realtor' && brokerageName?.trim()) {
        const name = sanitizeText(brokerageName.trim()) || brokerageName.trim();
        await service
          .from('businesses')
          .update({ business_name: name })
          .eq('id', profile.business_id);
      }

      invalidateBusinessDirectoryCache();
    }

    const { data: roleRows } = await service
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true);

    const roles = (roleRows || []).map((row) => row.role);
    return NextResponse.json({
      ok: true,
      roles,
      accountRole: primaryProAccountRole(roles),
    });
  } catch (error) {
    console.error('POST /api/profile/roles/switch', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to switch role' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return requireAuth(handleSwitch)(request);
}
