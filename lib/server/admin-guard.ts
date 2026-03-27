import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifyAdminSession } from './admin-auth';

export function requireAdmin(request: NextRequest): NextResponse | null {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;

  if (!verifyAdminSession(token)) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  return null;
}
