import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';

/**
 * The CRM estimate form's rules, shared by the CRM estimates page and the chat's estimate window
 * so both check and save an estimate the same way.
 */

export interface EstimateFormLine {
  product_or_service?: string;
  description?: string;
  unit?: string;
  qty: number;
  rate_cents: number;
  amount_cents: number;
}

export interface EstimateCatalogItem {
  name: string;
  description?: string | null;
  unit?: string | null;
  price_cents: number;
}

export function blankEstimateLine(): EstimateFormLine {
  return { product_or_service: '', description: '', unit: DEFAULT_UNIT, qty: 1, rate_cents: 0, amount_cents: 0 };
}

/** The lines the API saves: the ones with something in them. */
export function estimateLinesPayload(lines: EstimateFormLine[]) {
  return lines
    .filter((line) => line.description || line.product_or_service || line.amount_cents > 0)
    .map((line) => ({
      product_or_service: line.product_or_service || null,
      description: line.description || null,
      unit: line.unit || DEFAULT_UNIT,
      qty: line.qty,
      rate_cents: line.rate_cents,
      amount_cents: line.amount_cents,
    }));
}

export function estimateTotalCents(lines: EstimateFormLine[]): number {
  return estimateLinesPayload(lines).reduce((sum, line) => sum + line.amount_cents, 0);
}

/** The deposit typed in dollars, checked against the estimate total. */
export function estimateDeposit(deposit: string, totalCents: number): { cents: number; error: string | null } {
  const trimmed = deposit.trim();
  if (!trimmed) return { cents: 0, error: null };
  const dollars = Number(trimmed);
  if (!Number.isFinite(dollars) || dollars < 0) return { cents: 0, error: 'Enter a deposit amount' };
  const cents = Math.round(dollars * 100);
  if (cents > totalCents) return { cents, error: 'Deposit cannot be more than the estimate' };
  return { cents, error: null };
}

/** Why a new estimate cannot be saved yet, or null. */
export function estimateFormError(form: {
  customerId: string;
  lines: EstimateFormLine[];
  deposit: string;
  agreementKind: string;
  maintenanceFrequency: string;
}): string | null {
  if (!form.customerId) return 'Select a customer';
  const hasInvalidLine = form.lines.some((line) => {
    const touched =
      Boolean(line.description?.trim()) ||
      Boolean(line.product_or_service?.trim()) ||
      line.qty > 0 ||
      line.rate_cents > 0 ||
      line.amount_cents > 0;
    return touched && !line.product_or_service?.trim();
  });
  if (hasInvalidLine) return 'Choose a product or service from reusable items before saving.';
  const seen = new Set<string>();
  for (const line of form.lines) {
    const key = JSON.stringify({
      product_or_service: (line.product_or_service ?? '').trim().toLowerCase(),
      description: (line.description ?? '').trim().toLowerCase(),
      unit: (line.unit ?? '').trim().toLowerCase(),
      qty: line.qty,
      rate_cents: line.rate_cents,
      amount_cents: line.amount_cents,
    });
    if (seen.has(key)) return 'You have a duplicated item on your estimate. Modify one before creating.';
    seen.add(key);
  }
  const deposit = estimateDeposit(form.deposit, estimateTotalCents(form.lines));
  if (deposit.error) return deposit.error;
  if (form.agreementKind === 'maintenance' && !form.maintenanceFrequency) return 'Choose how often maintenance visits run';
  return null;
}

/** Put a catalog item on a line, keeping its quantity. */
export function applyCatalogItemToLine(line: EstimateFormLine, item: EstimateCatalogItem): EstimateFormLine {
  return {
    ...line,
    product_or_service: item.name,
    description: item.description ?? line.description,
    unit: item.unit || DEFAULT_UNIT,
    rate_cents: item.price_cents,
    amount_cents: Math.round((line.qty || 1) * item.price_cents),
  };
}

/** Add lines typed on the estimate to the pro's reusable items when they are new. */
export async function syncEstimateLinesToReusableItems(lines: ReturnType<typeof estimateLinesPayload>): Promise<void> {
  const incoming = lines
    .filter((line) => line.product_or_service && line.product_or_service.trim())
    .map((line) => ({
      name: (line.product_or_service ?? '').trim(),
      description: (line.description ?? '').trim(),
      unit: (line.unit ?? DEFAULT_UNIT).trim() || DEFAULT_UNIT,
      price_cents: Math.max(0, Math.round(line.rate_cents ?? 0)),
    }));
  if (incoming.length === 0) return;

  const existingRes = await fetch('/api/crm/items', { credentials: 'include' });
  const existingData = await existingRes.json().catch(() => ({}));
  const existingItems: EstimateCatalogItem[] = existingData.items ?? [];
  const keyOf = (item: { name: string; description: string; unit: string; price_cents: number }) =>
    JSON.stringify({
      name: item.name.toLowerCase(),
      description: item.description.toLowerCase(),
      unit: item.unit.toLowerCase(),
      price_cents: item.price_cents,
    });
  const existingKeys = new Set(
    existingItems.map((item) =>
      keyOf({
        name: (item.name ?? '').trim(),
        description: (item.description ?? '').trim(),
        unit: (item.unit ?? DEFAULT_UNIT).trim(),
        price_cents: Math.max(0, Math.round(item.price_cents ?? 0)),
      })
    )
  );

  for (const line of incoming) {
    const key = keyOf(line);
    if (existingKeys.has(key)) continue;
    const createRes = await fetch('/api/crm/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: line.name,
        item_type: 'service',
        description: line.description || undefined,
        price_cents: line.price_cents,
        unit: line.unit,
      }),
    });
    if (createRes.ok) existingKeys.add(key);
  }
}
