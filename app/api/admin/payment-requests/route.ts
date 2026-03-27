import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { listPendingPaymentRequests } from '@/lib/server/admin-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const requests = await listPendingPaymentRequests();
  return NextResponse.json({ requests });
}
