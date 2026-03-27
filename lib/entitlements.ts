export type AccountMode = 'DEMO' | 'PAID_FULL';
export type PaymentStatus = 'NONE' | 'PENDING' | 'CONFIRMED';

export type AppFeatureKey =
  | 'reservas'
  | 'calendario'
  | 'cuentas'
  | 'clientes'
  | 'lead_finder'
  | 'dashboard'
  | 'puntos'
  | 'recompensas'
  | 'contenido';

export const ALL_APP_FEATURES: AppFeatureKey[] = [
  'reservas',
  'calendario',
  'cuentas',
  'clientes',
  'lead_finder',
  'dashboard',
  'puntos',
  'recompensas',
  'contenido',
];

export const FREE_APP_FEATURES: AppFeatureKey[] = ['reservas', 'calendario', 'cuentas', 'clientes'];

export interface AccountAccess {
  mode: AccountMode;
  isPaid: boolean;
  demoEndsAt: string | null;
  enabledApps: AppFeatureKey[];
  planName: string | null;
  hasChosenPlan: boolean;
  paymentStatus: PaymentStatus;
}

export function normalizeEnabledApps(input: unknown): AppFeatureKey[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((value): value is AppFeatureKey => {
    return typeof value === 'string' && ALL_APP_FEATURES.includes(value as AppFeatureKey);
  });
}

export function buildAccountAccess(payload: any): AccountAccess {
  const mode = normalizeMode(payload?.accountAccess?.mode ?? payload?.planMode ?? payload?.mode);
  const enabledFromPayload = normalizeEnabledApps(
    payload?.accountAccess?.enabledApps ?? payload?.enabledApps,
  );
  const hasChosenPlan = Boolean(payload?.accountAccess?.hasChosenPlan ?? payload?.hasChosenPlan ?? false);
  const paymentStatus = normalizePaymentStatus(
    payload?.accountAccess?.paymentStatus ?? payload?.paymentStatus,
  );

  if (mode === 'PAID_FULL') {
    return {
      mode,
      isPaid: Boolean(payload?.accountAccess?.isPaid ?? payload?.isPaid ?? true),
      demoEndsAt: null,
      enabledApps: ALL_APP_FEATURES,
      planName: payload?.accountAccess?.planName ?? payload?.planName ?? 'Plan Profesional',
      hasChosenPlan,
      paymentStatus,
    };
  }

  return {
    mode: 'DEMO',
    isPaid: false,
    demoEndsAt: payload?.accountAccess?.demoEndsAt ?? payload?.demoEndsAt ?? null,
    enabledApps: Array.from(new Set([...(enabledFromPayload.length ? enabledFromPayload : FREE_APP_FEATURES), ...FREE_APP_FEATURES])),
    planName: payload?.accountAccess?.planName ?? payload?.planName ?? 'Plan gratis',
    hasChosenPlan,
    paymentStatus,
  };
}

export function isFeatureEnabled(access: AccountAccess | null, feature: AppFeatureKey): boolean {
  if (!access) {
    return false;
  }

  if (!access.isPaid) {
    return FREE_APP_FEATURES.includes(feature);
  }

  if (access.mode === 'PAID_FULL') {
    return true;
  }

  return access.enabledApps.includes(feature);
}

function normalizeMode(value: unknown): AccountMode {
  if (value === 'PAID_CUSTOM') {
    return 'PAID_FULL';
  }
  if (value === 'PAID_FULL' || value === 'DEMO') {
    return value;
  }
  return 'DEMO';
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  if (value === 'PENDING' || value === 'CONFIRMED' || value === 'NONE') {
    return value;
  }
  return 'NONE';
}
