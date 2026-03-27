import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, HAS_MEMBERSHIP_COOKIE } from '@/lib/auth';
import { db } from '@/lib/server/db';
import { requireStaffAuth } from '@/lib/server/staff-guard';

function decodeJwtPayload(token: string): Record<string, any> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${'='.repeat(padLength)}`;
  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, any>;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  const payload = decodeJwtPayload(token);
  const userId = String(payload?.sub ?? payload?.userId ?? payload?.id ?? '').trim();
  if (!userId) {
    return NextResponse.json({ message: 'Token inválido' }, { status: 400 });
  }

  const rows = await db.query<{
    membershipId: string;
    role: string;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
  }>(
    `
      SELECT
        m.id AS "membershipId",
        m.role AS "role",
        m."tenantId" AS "tenantId",
        t.slug AS "tenantSlug",
        t.name AS "tenantName"
      FROM "Membership" m
      INNER JOIN "Tenant" t ON t.id = m."tenantId"
      WHERE m."userId" = $1
      ORDER BY t."createdAt" ASC
    `,
    [userId],
  );

  const memberships = rows.rows.map((row) => ({
    membershipId: row.membershipId,
    role: row.role,
    tenantId: row.tenantId,
    tenantSlug: row.tenantSlug,
    tenantName: row.tenantName,
  }));
  const hasMembership = memberships.length > 0;

  const response = NextResponse.json({ hasMembership, memberships }, { status: 200 });
  response.cookies.set(HAS_MEMBERSHIP_COOKIE, hasMembership ? '1' : '0', {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  return response;
}
