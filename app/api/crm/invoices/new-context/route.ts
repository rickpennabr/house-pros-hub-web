import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { getDefaultCompanyForInvoice } from '@/lib/invoices/defaultCompany';

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
 * GET /api/crm/invoices/new-context
 * Returns theme, next invoice number preview, and default business for the New Invoice WYSIWYG form.
 */
export async function GET() {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const supabase = await createClient();
    let { data: settings } = await supabase
      .from('pro_invoice_settings')
      .select('default_business_id, default_display_name_id, theme_color_hex, invoice_prefix, next_number')
      .eq('owner_id', user.id)
      .single();

    if (!settings) {
      const { data: firstBiz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();
      await supabase.from('pro_invoice_settings').insert({
        owner_id: user.id,
        default_business_id: firstBiz?.id ?? null,
        theme_color_hex: '#000000',
        invoice_prefix: 'INV',
        next_number: 1,
      });
      settings = {
        default_business_id: firstBiz?.id ?? null,
        default_display_name_id: null,
        theme_color_hex: '#000000',
        invoice_prefix: 'INV',
        next_number: 1,
      };
    }

    const themeColorHex = (settings as { theme_color_hex?: string }).theme_color_hex ?? '#000000';
    const prefix = (settings as { invoice_prefix?: string }).invoice_prefix || 'INV';
    const nextNum = (settings as { next_number?: number }).next_number ?? 1;
    const nextInvoiceNumber = `${prefix}-${String(nextNum).padStart(4, '0')}`;

    const business = await getDefaultCompanyForInvoice(supabase, user.id);

    return NextResponse.json({
      themeColorHex,
      invoicePrefix: prefix,
      nextNumber: nextNum,
      nextInvoiceNumber,
      business: business ?? {
        id: '',
        business_name: 'My Business',
        business_logo: null,
        email: null,
        phone: null,
        address: null,
        company_tagline: null,
        website: undefined,
      },
    });
  } catch (err) {
    console.error('GET /api/crm/invoices/new-context', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
