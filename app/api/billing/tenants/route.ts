import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { listUserOwnedTenants } from '@/lib/server/admin-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ message: 'userId es obligatorio' }, { status: 400 });
  }

  const tenants = await listUserOwnedTenants(userId);
  return NextResponse.json({ tenants });
}
