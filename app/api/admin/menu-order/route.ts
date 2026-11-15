import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/blog/admin';
import { normalizeMainMenuOrder } from '@/lib/constants/mainMenu';
import { readMainMenuOrder, writeMainMenuOrder } from '@/lib/navigation/mainMenuOrder';

/** GET /api/admin/menu-order */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json(await readMainMenuOrder());
}

/** PUT /api/admin/menu-order — body: { order: string[] } */
export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const order = normalizeMainMenuOrder(body.order);
  const saved = await writeMainMenuOrder(order);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });
  return NextResponse.json({ order });
}
