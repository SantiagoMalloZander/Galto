'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStoredAuthSession, type AuthSession } from '@/lib/auth';
import { isFeatureEnabled, type AppFeatureKey } from '@/lib/entitlements';

export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getStoredAuthSession());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncSession = () => setSession(getStoredAuthSession());
    window.addEventListener('storage', syncSession);
    window.addEventListener('galto-auth-updated', syncSession as EventListener);

    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('galto-auth-updated', syncSession as EventListener);
    };
  }, []);

  const canAccess = useCallback((feature: AppFeatureKey): boolean => {
    return isFeatureEnabled(session?.accountAccess ?? null, feature);
  }, [session?.accountAccess]);

  return {
    session,
    canAccess,
  };
}
