export type LandingPlan = 'DEMO' | 'PAID_FULL';

export type BusinessLine = 'BARBERIA' | 'PELUQUERIA' | 'ESTETICA';

export type LatamCountry = {
  code: string;
  name: string;
};

export type PreplanOnboardingProfile = {
  businessLine: BusinessLine;
  workersCount: number;
  countryCode: string;
  countryName: string;
};

export const PREPLAN_ONBOARDING_STORAGE_KEY = 'galto_preplan_onboarding_v1';

export const LATAM_COUNTRIES: LatamCountry[] = [
  { code: 'AR', name: 'Argentina' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CU', name: 'Cuba' },
  { code: 'DO', name: 'Republica Dominicana' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'PA', name: 'Panama' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
];

export const BUSINESS_LINE_OPTIONS: Array<{ value: BusinessLine; label: string; seededService: string }> = [
  { value: 'BARBERIA', label: 'Barberias', seededService: 'Corte clasico' },
  { value: 'PELUQUERIA', label: 'Peluquerias', seededService: 'Corte y peinado' },
  { value: 'ESTETICA', label: 'Centros de estetica', seededService: 'Limpieza facial' },
];

export function isLandingPlan(value: unknown): value is LandingPlan {
  return value === 'DEMO' || value === 'PAID_FULL';
}

export function normalizeWorkersCount(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(500, Math.max(1, parsed));
}

export function normalizeBusinessLine(value: unknown): BusinessLine {
  if (value === 'PELUQUERIA') return 'PELUQUERIA';
  if (value === 'ESTETICA') return 'ESTETICA';
  return 'BARBERIA';
}

export function normalizeCountryCode(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw.length < 2) return 'AR';
  return raw.slice(0, 2);
}

export function resolveCountryName(countryCode: string): string {
  return LATAM_COUNTRIES.find((country) => country.code === countryCode)?.name ?? LATAM_COUNTRIES[0].name;
}

export function resolvePlanAfterPreOnboarding(plan: LandingPlan | null): string {
  if (plan === 'PAID_FULL') {
    return `/pago?plan=${encodeURIComponent(plan)}`;
  }
  if (plan === 'DEMO') {
    return `/planes?plan=${encodeURIComponent(plan)}`;
  }
  return '/planes';
}
