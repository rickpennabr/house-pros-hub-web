import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth, type AuthenticatedRequest } from '@/lib/middleware/auth';
import {
  findInvitationCode,
  invitationCodeBlockReason,
  parseInvitationRole,
} from '@/lib/auth/invitationCodes';
import { primaryProAccountRole } from '@/lib/utils/proAccountRole';
import { invalidateBusinessDirectoryCache } from '@/lib/data/businessDirectory';
import { sanitizeText } from '@/lib/utils/sanitize';
import {
  isValidNevadaRealtorLicenseNumber,
  normalizeNevadaRealtorLicenseNumber,
  nevadaRealtorLicenseHint,
} from '@/lib/utils/nevadaRealtorLicense';

/** Roles that may upgrade, and the roles they may upgrade to. */
const UPGRADABLE_FROM = new Set(['handyman', 'installer']);

const bodySchema = z.object({
  role: z.enum(['contractor', 'realtor']),
  invitationCode: z.string().trim().min(1),
  /** The license this business is upgrading with. Omit when one is already on file. */
  license: z
    .object({
      license: z.string().trim().min(1),
      licenseNumber: z.string().trim().min(1),
    })
    .optional(),
  /** Realtor only: Nevada ads must show the brokerage name, so it becomes the business name. */
  brokerageName: z.string().trim().optional(),
});

type CategoryRow = { code: string; requires_contractor_license: boolean; role: string | null };

/** License codes that qualify a business for the target role. */
function qualifyingCodes(categories: CategoryRow[], role: 'contractor' | 'realtor'): Set<string> {
  return new Set(
    categories
      .filter((c) =>
        role === 'contractor'
          ? (c.role ?? 'contractor') === 'contractor' && c.requires_contractor_license
          : c.role === 'realtor'
      )
      .map((c) => c.code)
  );
}

async function activateOnly(userId: string, role: 'contractor' | 'realtor') {
  const service = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data: rows, error: lookupError } = await service
    .from('user_roles')
    .select('id, role')
    .eq('user_id', userId);
  if (lookupError) throw new Error(lookupError.message);

  const existing = (rows || []).find((row) => row.role === role);
  if (existing) {
    const { error } = await service
      .from('user_roles')
      .update({ is_active: true, activated_at: now, deactivated_at: null })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await service.from('user_roles').insert({
      user_id: userId,
      role,
      is_active: true,
      activated_at: now,
      deactivated_at: null,
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

/**
 * POST /api/businesses/[id]/upgrade
 * A handyman or installer upgrades their business to contractor or realtor.
 * Needs an invitation code plus the license for the new role (unless this
 * business already has one on file). Pros cannot change their role any other way.
 */
async function handleUpgrade(request: AuthenticatedRequest, businessId: string) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const raw = request._body || (await request.json().catch(() => ({})));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Choose contractor or realtor and enter your invitation code.' }, { status: 400 });
    }
    const { role, invitationCode, license, brokerageName } = parsed.data;

    const service = createServiceRoleClient();

    const { data: business, error: businessError } = await service
      .from('businesses')
      .select('id, owner_id, business_name, licenses ( license_type, license_number )')
      .eq('id', businessId)
      .maybeSingle();
    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (business.owner_id !== userId) {
      return NextResponse.json({ error: 'Only the owner can upgrade this business' }, { status: 403 });
    }

    const { data: roleRows } = await service
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true);
    const currentRole = primaryProAccountRole((roleRows || []).map((row) => row.role));
    if (!currentRole || !UPGRADABLE_FROM.has(currentRole)) {
      return NextResponse.json(
        { error: 'Only handyman and installer businesses can be upgraded.' },
        { status: 400 }
      );
    }

    // Validate everything before the invitation code is spent.
    const { data: categoryRows } = await service
      .from('license_categories')
      .select('code, requires_contractor_license, role');
    const qualifying = qualifyingCodes((categoryRows || []) as CategoryRow[], role);
    const onFile = ((business.licenses || []) as { license_type: string | null }[]).some(
      (l) => !!l.license_type && qualifying.has(l.license_type)
    );

    let newLicense: { license: string; licenseNumber: string } | null = null;
    if (license) {
      if (!qualifying.has(license.license)) {
        return NextResponse.json(
          { error: `That license type does not qualify for ${role}.` },
          { status: 400 }
        );
      }
      const number =
        role === 'realtor' ? normalizeNevadaRealtorLicenseNumber(license.licenseNumber) : license.licenseNumber;
      if (role === 'realtor' && !isValidNevadaRealtorLicenseNumber(number, license.license)) {
        return NextResponse.json({ error: nevadaRealtorLicenseHint(license.license) }, { status: 400 });
      }
      newLicense = { license: license.license, licenseNumber: number };
    } else if (!onFile) {
      return NextResponse.json(
        {
          error:
            role === 'contractor'
              ? 'Add your contractor license classification and number.'
              : 'Add your Nevada real estate license type and number.',
        },
        { status: 400 }
      );
    }

    const brokerage = role === 'realtor' ? sanitizeText(brokerageName?.trim() || '') : '';
    if (role === 'realtor' && !brokerage) {
      return NextResponse.json(
        { error: 'Enter your brokerage name (required on Nevada ads).' },
        { status: 400 }
      );
    }

    const code = invitationCode.toUpperCase();
    const { row, error: codeError } = await findInvitationCode(service, parseInvitationRole(role), code);
    const block = codeError ? 'Invalid or expired invitation code.' : invitationCodeBlockReason(row);
    if (block || !row) {
      return NextResponse.json({ error: block || 'Invalid invitation code' }, { status: 400 });
    }

    // Claim the code only if nobody else claimed it first.
    const { data: claimed, error: useError } = await service
      .from('invitation_codes')
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq('id', row.id)
      .is('used_at', null)
      .select('id');
    if (useError || !claimed?.length) {
      return NextResponse.json(
        { error: useError?.message || 'This invitation code was already used.' },
        { status: 400 }
      );
    }

    if (newLicense) {
      // Add the new license first in the list; keep the business's other licenses.
      const { error: licenseError } = await service.from('licenses').insert({
        business_id: business.id,
        license_type: sanitizeText(newLicense.license) || newLicense.license,
        license_number: sanitizeText(newLicense.licenseNumber) || newLicense.licenseNumber,
        license_name: null,
        is_active: true,
      });
      if (licenseError) {
        // Give the code back so the person can try again.
        await service.from('invitation_codes').update({ used_at: null, used_by: null }).eq('id', row.id);
        return NextResponse.json(
          {
            error:
              licenseError.code === '23505'
                ? 'A license with this number already exists.'
                : licenseError.message || 'Failed to save the license',
          },
          { status: 400 }
        );
      }
    }

    if (role === 'realtor' && brokerage !== business.business_name) {
      await service.from('businesses').update({ business_name: brokerage }).eq('id', business.id);
    }

    await activateOnly(userId, role);
    invalidateBusinessDirectoryCache();

    const { data: licenseRows } = await service
      .from('licenses')
      .select('license_type, license_number')
      .eq('business_id', business.id);

    return NextResponse.json({
      ok: true,
      accountRole: role,
      businessName: role === 'realtor' ? brokerage : business.business_name,
      licenses: (licenseRows || []).map((l) => ({
        license: l.license_type || '',
        licenseNumber: l.license_number || '',
      })),
    });
  } catch (error) {
    console.error('POST /api/businesses/[id]/upgrade', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upgrade business' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return requireAuth((authRequest: AuthenticatedRequest) => handleUpgrade(authRequest, id))(request);
}
