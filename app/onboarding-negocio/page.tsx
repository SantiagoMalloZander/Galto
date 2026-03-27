'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getStoredAuthSession } from '@/lib/auth';
import {
  BUSINESS_LINE_OPTIONS,
  isLandingPlan,
  LATAM_COUNTRIES,
  normalizeBusinessLine,
  normalizeCountryCode,
  normalizeWorkersCount,
  PREPLAN_ONBOARDING_STORAGE_KEY,
  resolveCountryName,
  resolvePlanAfterPreOnboarding,
  type BusinessLine,
  type LandingPlan,
  type PreplanOnboardingProfile,
} from '@/lib/onboarding-profile';

type TenantMembership = {
  tenantId: string;
};

function readStoredProfile(): PreplanOnboardingProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PREPLAN_ONBOARDING_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PreplanOnboardingProfile>;
    const countryCode = normalizeCountryCode(parsed.countryCode);
    return {
      businessLine: normalizeBusinessLine(parsed.businessLine),
      workersCount: normalizeWorkersCount(parsed.workersCount),
      countryCode,
      countryName: resolveCountryName(countryCode),
    };
  } catch {
    return null;
  }
}

export default function OnboardingNegocioPage() {
  const router = useRouter();
  const [session] = useState(() => getStoredAuthSession());
  const [selectedPlan, setSelectedPlan] = useState<LandingPlan | null>(null);
  const [businessLine, setBusinessLine] = useState<BusinessLine>('BARBERIA');
  const [workersCount, setWorkersCount] = useState('1');
  const [countryCode, setCountryCode] = useState('AR');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredProfile();
    if (stored) {
      setBusinessLine(stored.businessLine);
      setWorkersCount(String(stored.workersCount));
      setCountryCode(stored.countryCode);
    }

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const plan = params?.get('plan');
    if (isLandingPlan(plan)) {
      setSelectedPlan(plan);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const plan = params?.get('plan');
      const loginUrl = new URL('/login', window.location.origin);
      if (isLandingPlan(plan)) {
        loginUrl.searchParams.set('plan', plan);
      }
      loginUrl.searchParams.set('next', window.location.pathname + window.location.search);
      router.replace(loginUrl.pathname + loginUrl.search);
      return;
    }

    void checkIfHasTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const selectedCountry = useMemo(() => {
    return LATAM_COUNTRIES.find((country) => country.code === countryCode) ?? LATAM_COUNTRIES[0];
  }, [countryCode]);

  async function checkIfHasTenant() {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/billing/tenants?userId=${encodeURIComponent(session.user.id)}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudieron cargar tus negocios');
      }
      const tenants = Array.isArray(payload?.tenants) ? (payload.tenants as TenantMembership[]) : [];
      if (tenants.length > 0) {
        router.replace('/app/inicio');
        return;
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo validar tu cuenta');
    } finally {
      setLoading(false);
    }
  }

  function continueToPlans() {
    const profile: PreplanOnboardingProfile = {
      businessLine,
      workersCount: normalizeWorkersCount(workersCount),
      countryCode: selectedCountry.code,
      countryName: selectedCountry.name,
    };
    window.localStorage.setItem(PREPLAN_ONBOARDING_STORAGE_KEY, JSON.stringify(profile));
    router.replace(resolvePlanAfterPreOnboarding(selectedPlan));
  }

  function handleContinue() {
    setSaving(true);
    setError(null);
    try {
      continueToPlans();
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar la configuración inicial');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-8 text-sm text-muted-foreground">Preparando configuración inicial...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-muted/30">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Antes de planes, contanos tu negocio</CardTitle>
            <CardDescription>
              Te pedimos estos datos para dejarte todo preconfigurado desde el inicio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessLine">Qué tipo de servicio da tu negocio</Label>
              <select
                id="businessLine"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={businessLine}
                onChange={(event) => setBusinessLine(event.target.value as BusinessLine)}
                disabled={saving}
              >
                {BUSINESS_LINE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Servicio característico que dejamos preconfigurado:{" "}
                <strong>{BUSINESS_LINE_OPTIONS.find((item) => item.value === businessLine)?.seededService}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workersCount">Cantidad de personas que trabajan en el negocio</Label>
              <Input
                id="workersCount"
                type="number"
                min={1}
                max={500}
                value={workersCount}
                onChange={(event) => setWorkersCount(event.target.value)}
                onBlur={() => setWorkersCount(String(normalizeWorkersCount(workersCount)))}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">Este dato se guarda para personalizar el tutorial.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="countryCode">País de origen</Label>
              <select
                id="countryCode"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                disabled={saving}
              >
                {LATAM_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button onClick={handleContinue} disabled={saving} className="w-full">
              {saving ? 'Guardando...' : 'Continuar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

