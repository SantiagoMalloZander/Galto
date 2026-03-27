import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { listCustomerAccounts } from '@/lib/server/customer-accounts';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const search = request.nextUrl.searchParams.get('search');
  const customers = await listCustomerAccounts({ search, limit: 500 });
  return NextResponse.json({ customers });
}
