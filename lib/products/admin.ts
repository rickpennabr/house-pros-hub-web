import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/blog/admin';

export function isMissingProductsStorage(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /base_products/i.test(error.message ?? '');
}

export async function requireProductsAdmin() {
  return requireAdmin();
}

export function productsStorageError() {
  return NextResponse.json(
    { error: 'Product storage is not ready. Apply supabase/migrations/085_products.sql in the House Pros Hub database.' },
    { status: 503 }
  );
}
