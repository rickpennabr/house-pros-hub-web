import { NextResponse } from 'next/server';
import { CatalogError, catalogNotReadyMessage, isMissingCatalogTable } from '@/lib/crm/catalog-db';

export function catalogErrorResponse(error: unknown, logLabel: string) {
  if (error instanceof CatalogError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const known = error as { code?: string; message?: string };
  if (isMissingCatalogTable(known)) {
    return NextResponse.json({ error: catalogNotReadyMessage() }, { status: 503 });
  }
  console.error(logLabel, error);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}
