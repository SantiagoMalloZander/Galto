import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { listCalendarBranchesForUser } from '@/lib/server/reservas-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const branches = await listCalendarBranchesForUser({ tenantId, userId });
  return NextResponse.json({ branches });
}
