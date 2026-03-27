import crypto from 'crypto';

export const CUSTOMER_ACCESS_COOKIE = 'galto_customer_access_token';
export const CUSTOMER_REFRESH_COOKIE = 'galto_customer_refresh_token';

const CUSTOMER_SESSION_SECRET = process.env.CUSTOMER_SESSION_SECRET ?? 'change-this-customer-session-secret';

interface TokenPayload {
  customerUserId: string;
  phone: string;
  type: 'access' | 'refresh';
  iat: number;
}

function sign(payload: TokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', CUSTOMER_SESSION_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function signCustomerAccessToken(input: { customerUserId: string; phone: string }) {
  return sign({
    customerUserId: input.customerUserId,
    phone: input.phone,
    type: 'access',
    iat: Date.now(),
  });
}

export function signCustomerRefreshToken(input: { customerUserId: string; phone: string }) {
  return sign({
    customerUserId: input.customerUserId,
    phone: input.phone,
    type: 'refresh',
    iat: Date.now(),
  });
}

export function verifyCustomerToken(token: string | null | undefined, expectedType: 'access' | 'refresh') {
  if (!token) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', CUSTOMER_SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload?.customerUserId || !payload?.phone || payload?.type !== expectedType || typeof payload?.iat !== 'number') {
      return null;
    }

    const maxAgeMs = expectedType === 'access' ? 1000 * 60 * 15 : 1000 * 60 * 60 * 24 * 30;
    if (Date.now() - payload.iat > maxAgeMs) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
