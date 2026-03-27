import { NextRequest, NextResponse } from 'next/server';

const ACCESS_TOKEN_COOKIE = 'galto_access_token';
const ADMIN_COOKIE = 'galto_admin_session';
const HAS_MEMBERSHIP_COOKIE = 'galto_has_membership';

type MembershipSyncResult = {
  hasMembership: boolean;
  memberships: Array<{ role: string }>;
};

async function syncMembershipsFromBackend(req: NextRequest): Promise<MembershipSyncResult | null> {
  try {
    const response = await fetch(new URL('/api/auth/memberships', req.url), {
      method: 'GET',
      headers: {
        cookie: req.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }
    return (await response.json()) as MembershipSyncResult;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get('host')?.toLowerCase() ?? '';

  if (pathname.startsWith('/_next') || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const adminToken = req.cookies.get(ADMIN_COOKIE)?.value;
  const hasMembership = req.cookies.get(HAS_MEMBERSHIP_COOKIE)?.value;

  if (host.startsWith('wpp.galto.online')) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/wpp/login', req.url));
    }
    if (pathname.startsWith('/wpp') && pathname !== '/wpp/login' && !adminToken) {
      return NextResponse.redirect(new URL('/wpp/login', req.url));
    }
    if (pathname === '/wpp/login' && adminToken) {
      return NextResponse.redirect(new URL('/wpp', req.url));
    }
    if (pathname.startsWith('/app')) {
      return NextResponse.redirect(new URL('/wpp', req.url));
    }
  }

  if (pathname.startsWith('/app') && !token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/planes' && !token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/onboarding-negocio' && !token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/planes' && token && hasMembership === '1') {
    return NextResponse.redirect(new URL(`/app/planes${search}`, req.url));
  }

  if (pathname === '/onboarding-negocio' && token && hasMembership === '1') {
    return NextResponse.redirect(new URL('/app/inicio', req.url));
  }

  if (pathname === '/app/planes' && token) {
    const sync = await syncMembershipsFromBackend(req);
    const hasOwnerRole = Boolean(sync?.memberships?.some((membership) => membership.role === 'OWNER'));
    if (sync && !hasOwnerRole) {
      const response = NextResponse.redirect(new URL('/app/inicio', req.url));
      if (sync) {
        response.cookies.set(HAS_MEMBERSHIP_COOKIE, sync.hasMembership ? '1' : '0', {
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
          sameSite: 'lax',
          secure: req.nextUrl.protocol === 'https:',
        });
      }
      return response;
    }
  }

  if (pathname.startsWith('/app') && token && hasMembership !== '1') {
    const sync = await syncMembershipsFromBackend(req);
    if (sync?.hasMembership) {
      const response = NextResponse.next();
      response.cookies.set(HAS_MEMBERSHIP_COOKIE, '1', {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
        secure: req.nextUrl.protocol === 'https:',
      });
      return response;
    }
    return NextResponse.redirect(new URL('/planes', req.url));
  }

  if ((pathname === '/login' || pathname === '/registro') && token && hasMembership === '1') {
    const plan = req.nextUrl.searchParams.get('plan');
    if (plan === 'PAID_FULL') {
      return NextResponse.redirect(new URL(`/pago?plan=${encodeURIComponent(plan)}`, req.url));
    }
    return NextResponse.redirect(new URL('/app/inicio', req.url));
  }

  if ((pathname === '/login' || pathname === '/registro') && token && hasMembership === '0') {
    const plan = req.nextUrl.searchParams.get('plan');
    if (plan === 'DEMO' || plan === 'PAID_FULL') {
      return NextResponse.redirect(new URL(`/onboarding-negocio?plan=${encodeURIComponent(plan)}`, req.url));
    }
    return NextResponse.redirect(new URL('/planes', req.url));
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !adminToken) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  if (pathname === '/admin/login' && adminToken) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!favicon.ico).*)'],
};
