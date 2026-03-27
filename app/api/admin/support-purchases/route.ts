import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { listSupportPurchasesForAdmin } from '@/lib/server/support-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const purchases = await listSupportPurchasesForAdmin();
  return NextResponse.json({ purchases });
}
