import { NextResponse } from 'next/server';
import { DriveAuthError, DriveForbiddenError, DriveQuotaError } from '@/lib/drive/server';

export function driveErrorResponse(error: unknown) {
  if (error instanceof DriveAuthError) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (error instanceof DriveForbiddenError) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (error instanceof DriveQuotaError) {
    return NextResponse.json({ error: 'DRIVE_QUOTA_EXCEEDED', usage: error.usage }, { status: 402 });
  }
  const message = error instanceof Error ? error.message : 'ProDrive request failed';
  return NextResponse.json({ error: message }, { status: 400 });
}

export function parseOwner(value: string | null): 'user' | 'business' | null {
  if (value === 'user' || value === 'business') return value;
  return null;
}
