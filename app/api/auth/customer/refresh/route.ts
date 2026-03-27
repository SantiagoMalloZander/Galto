import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  signCustomerAccessToken,
  signCustomerRefreshToken,
  verifyCustomerToken,
} from '@/lib/server/customer-auth';
import { getCustomerUserById } from '@/lib/server/customer-accounts';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value ?? null;
  const payload = verifyCustomerToken(refreshToken, 'refresh');
  if (!payload) {
    return NextResponse.json({ message: 'Refresh inválido' }, { status: 401 });
  }

  const customerUser = await getCustomerUserById(payload.customerUserId);
  if (!customerUser) {
    return NextResponse.json({ message: 'Cliente no encontrado' }, { status: 401 });
  }

  const accessToken = signCustomerAccessToken({
    customerUserId: customerUser.id,
    phone: customerUser.phone,
  });
  const nextRefresh = signCustomerRefreshToken({
    customerUserId: customerUser.id,
    phone: customerUser.phone,
  });

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isHttps = forwardedProto === 'https' || request.nextUrl.protocol === 'https:';

  const response = NextResponse.json({
    ok: true,
    customerUser,
    accessToken,
  });

  response.cookies.set({
    name: CUSTOMER_ACCESS_COOKIE,
    value: accessToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 60 * 15,
  });
  response.cookies.set({
    name: CUSTOMER_REFRESH_COOKIE,
    value: nextRefresh,
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
