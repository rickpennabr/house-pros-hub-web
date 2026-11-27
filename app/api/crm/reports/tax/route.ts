import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireContractor } from '@/lib/crm/require-contractor';
import { loadTaxYearSummary } from '@/lib/tax/year-summary';

/**
 * GET /api/crm/reports/tax?year=2026
 * The pro's tax year (Schedule C style). Owner only; RLS limits rows to their books.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const thisYear = new Date().getFullYear();
    const asked = Number(new URL(request.url).searchParams.get('year'));
    const year = Number.isInteger(asked) && asked >= 2000 && asked <= thisYear ? asked : thisYear;
    const summary = await loadTaxYearSummary(supabase as unknown as SupabaseClient, user.id, year);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not build the tax summary' }, { status: 500 });
  }
}
