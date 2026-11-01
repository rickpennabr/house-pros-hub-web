import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

/** Allocate the next invoice number and advance the contractor sequence. */
export async function getNextInvoiceNumber(
  supabase: SupabaseClient<Database>,
  ownerId: string
): Promise<string> {
  let { data: settings } = await supabase
    .from('pro_invoice_settings')
    .select('invoice_prefix, next_number')
    .eq('owner_id', ownerId)
    .single();

  if (!settings) {
    const { data: firstBiz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .limit(1)
      .single();
    await supabase.from('pro_invoice_settings').insert({
      owner_id: ownerId,
      default_business_id: firstBiz?.id ?? null,
      theme_color_hex: '#000000',
      invoice_prefix: 'INV',
      next_number: 1,
    });
    settings = { invoice_prefix: 'INV', next_number: 1 };
  }

  const prefix = settings.invoice_prefix || 'INV';
  const num = settings.next_number ?? 1;
  const invoiceNumber = `${prefix}-${String(num).padStart(4, '0')}`;

  await supabase
    .from('pro_invoice_settings')
    .update({ next_number: num + 1 })
    .eq('owner_id', ownerId);

  return invoiceNumber;
}
