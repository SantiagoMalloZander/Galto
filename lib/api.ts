export function getApiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!base) {
    return '/v1';
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
}
