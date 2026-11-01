import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * GET /api/crm/invoice-settings
 * Returns invoice settings for the current contractor. Creates default row if none exists.
 */
export async function GET() {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const supabase = await createClient();
    let { data: settings, error } = await supabase
      .from('pro_invoice_settings')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 });
    }

    if (!settings) {
      const { data: firstBusiness } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      const { data: inserted, error: insertError } = await supabase
        .from('pro_invoice_settings')
        .insert({
          owner_id: user.id,
          default_business_id: firstBusiness?.id ?? null,
          theme_color_hex: '#000000',
          invoice_prefix: 'INV',
          next_number: 1,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message || 'Failed to create settings' }, { status: 500 });
      }
      settings = inserted;
    }

    const { data: displayNames } = await supabase
      .from('pro_invoice_display_names')
      .select('id, display_name')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      settings,
      displayNames: displayNames ?? [],
    });
  } catch (err) {
    console.error('GET /api/crm/invoice-settings', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/invoice-settings
 * Updates invoice settings. Upserts so first PATCH creates the row if needed.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const body = await request.json();
    const defaultBusinessId =
      body.defaultBusinessId !== undefined
        ? (body.default_business_id ?? body.defaultBusinessId)
        : undefined;
    const defaultDisplayNameId =
      body.defaultDisplayNameId !== undefined
        ? (body.default_display_name_id ?? body.defaultDisplayNameId)
        : undefined;
    const themeColorHex =
      typeof body.themeColorHex === 'string'
        ? body.themeColorHex.trim()
        : typeof body.theme_color_hex === 'string'
          ? body.theme_color_hex.trim()
          : undefined;
    const invoicePrefix =
      typeof body.invoicePrefix === 'string'
        ? body.invoicePrefix.trim()
        : typeof body.invoice_prefix === 'string'
          ? body.invoice_prefix.trim()
          : undefined;
    const nextNumber =
      typeof body.nextNumber === 'number'
        ? body.nextNumber
        : typeof body.next_number === 'number'
          ? body.next_number
          : undefined;
    const companyTagline =
      body.companyTagline !== undefined
        ? (body.company_tagline ?? body.companyTagline)
        : undefined;
    const taglineValue =
      typeof companyTagline === 'string' ? (companyTagline.trim() || null) : companyTagline;

    const supabase = await createClient();

    if (defaultBusinessId !== undefined && defaultBusinessId !== null) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('id', defaultBusinessId)
        .eq('owner_id', user.id)
        .single();
      if (!biz) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }
    }
    if (defaultDisplayNameId !== undefined && defaultDisplayNameId !== null) {
      const { data: dn } = await supabase
        .from('pro_invoice_display_names')
        .select('id')
        .eq('id', defaultDisplayNameId)
        .eq('owner_id', user.id)
        .single();
      if (!dn) {
        return NextResponse.json({ error: 'Display name not found' }, { status: 404 });
      }
    }

    const update: Record<string, unknown> = {};
    if (defaultBusinessId !== undefined) {
      update.default_business_id = defaultBusinessId || null;
      if (defaultBusinessId != null) update.default_display_name_id = null;
    }
    if (defaultDisplayNameId !== undefined) {
      update.default_display_name_id = defaultDisplayNameId || null;
      if (defaultDisplayNameId != null) update.default_business_id = null;
    }
    if (themeColorHex !== undefined) update.theme_color_hex = themeColorHex || '#000000';
    if (invoicePrefix !== undefined) update.invoice_prefix = invoicePrefix || 'INV';
    if (nextNumber !== undefined && Number.isInteger(nextNumber) && nextNumber >= 1)
      update.next_number = nextNumber;
    if (companyTagline !== undefined) update.company_tagline = taglineValue;

    if (Object.keys(update).length === 0) {
      const { data: existing } = await supabase
        .from('pro_invoice_settings')
        .select('*')
        .eq('owner_id', user.id)
        .single();
      return NextResponse.json({ settings: existing ?? null });
    }

    const { data: updated, error } = await supabase
      .from('pro_invoice_settings')
      .upsert(
        { owner_id: user.id, ...update },
        { onConflict: 'owner_id', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
    }
    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error('PATCH /api/crm/invoice-settings', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
