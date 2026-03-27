import { NextRequest, NextResponse } from 'next/server';
import { CUSTOMER_ACCESS_COOKIE, verifyCustomerToken } from '@/lib/server/customer-auth';
import { getCustomerUserById } from '@/lib/server/customer-accounts';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value ?? null;
  const payload = verifyCustomerToken(token, 'access');
  if (!payload) {
    return NextResponse.json({ authenticated: false });
  }

  const customerUser = await getCustomerUserById(payload.customerUserId);
  if (!customerUser) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true, customerUser });
}
