import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  isKnownAdminEmail,
  isValidAdminCredentials,
  signAdminSession,
} from '@/lib/server/admin-auth';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as any));
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!email || !password) {
    return NextResponse.json({ message: 'Email y contraseña son obligatorios' }, { status: 400 });
  }

  if (!isKnownAdminEmail(email)) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  if (!isValidAdminCredentials(email, password)) {
    return NextResponse.json({ message: 'Tu contraseña está incorrecta.' }, { status: 401 });
  }

  const token = signAdminSession(email);
  const response = NextResponse.json({ ok: true });
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isHttps = forwardedProto === 'https';

  response.cookies.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  return response;
}
