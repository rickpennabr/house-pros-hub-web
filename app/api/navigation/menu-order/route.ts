import { NextResponse } from 'next/server';
import { readMainMenuOrder } from '@/lib/navigation/mainMenuOrder';

/** GET /api/navigation/menu-order — public order of the header menu. */
export async function GET() {
  const result = await readMainMenuOrder();
  return NextResponse.json(result);
}
