import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  signCustomerAccessToken,
  signCustomerRefreshToken,
} from '@/lib/server/customer-auth';
import { verifyCustomerWhatsappOtp } from '@/lib/server/customer-accounts';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as any));
  const phone = String(body?.phone ?? '').trim();
  const code = String(body?.code ?? '').trim();
  const fullName = body?.fullName ? String(body.fullName) : null;

  if (!phone || !code) {
    return NextResponse.json({ message: 'phone y code son obligatorios' }, { status: 400 });
  }

  try {
    const { customerUser, isNew } = await verifyCustomerWhatsappOtp({ phone, code, fullName });
    const accessToken = signCustomerAccessToken({ customerUserId: customerUser.id, phone: customerUser.phone });
    const refreshToken = signCustomerRefreshToken({ customerUserId: customerUser.id, phone: customerUser.phone });

    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isHttps = forwardedProto === 'https' || request.nextUrl.protocol === 'https:';

    const response = NextResponse.json({
      ok: true,
      isNew,
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
      value: refreshToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo verificar el código' }, { status: 400 });
  }
}

