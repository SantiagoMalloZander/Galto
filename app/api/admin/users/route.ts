import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { listUsersWithMemberships } from '@/lib/server/admin-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const users = await listUsersWithMemberships();
  return NextResponse.json({ users });
}
