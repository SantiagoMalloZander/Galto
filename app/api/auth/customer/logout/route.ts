import { NextResponse } from 'next/server';
import { CUSTOMER_ACCESS_COOKIE, CUSTOMER_REFRESH_COOKIE } from '@/lib/server/customer-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: CUSTOMER_ACCESS_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set({
    name: CUSTOMER_REFRESH_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
  });

  return response;
}
