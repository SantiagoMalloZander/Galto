import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { listTenantsWithMembers } from '@/lib/server/admin-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const tenants = await listTenantsWithMembers();
  return NextResponse.json({ tenants });
}

