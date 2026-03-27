'use client'

import React from "react"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Scissors } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getApiBaseUrl } from '@/lib/api'
import { clearStoredAuth, getStoredAccessToken, getStoredAuthSession, persistAuthSession, updateStoredMemberships } from '@/lib/auth'
import { isLandingPlan, type LandingPlan } from '@/lib/onboarding-profile'

type InviteInfo = {
  valid: boolean
  tenantId?: string
  tenantName?: string
  reason?: 'OK' | 'INVALID' | 'USED' | 'EXPIRED'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextPath, setNextPath] = useState('/app/inicio')
  const [selectedPlan, setSelectedPlan] = useState<LandingPlan | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteTenantId, setInviteTenantId] = useState<string | null>(null)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [demoConfirmed, setDemoConfirmed] = useState(false)
  const [forcedNoAccount, setForcedNoAccount] = useState(false)

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const plan = params?.get('plan')
    const invite = params?.get('invite')
    const tenantId = params?.get('tenantId')
    const demoConfirmedParam = params?.get('demoConfirmed')
    const reason = params?.get('reason')
    if (reason === 'no-account') {
      setForcedNoAccount(true)
      clearStoredAuth()
    }
    if (isLandingPlan(plan)) {
      setSelectedPlan(plan)
    }
    if (invite) {
      setInviteToken(invite)
    }
    if (tenantId) {
      setInviteTenantId(tenantId)
    }
    if (demoConfirmedParam === '1') {
      setDemoConfirmed(true)
    }

    if (invite) {
      void loadInvitationInfo(invite).then((info) => setInviteInfo(info))
    }

    if (getStoredAccessToken() && reason !== 'no-account') {
      const storedSession = getStoredAuthSession()
      if (invite && storedSession?.user?.id) {
        void (async () => {
          try {
            const result = await acceptInvitation(invite, storedSession.user.id)
            if (result?.membership) {
              const nextMemberships = [
                result.membership,
                ...storedSession.memberships.filter((m) => m.tenantId !== result.membership?.tenantId),
              ]
              updateStoredMemberships(nextMemberships)
            }
            await syncMembershipsFromBackend()
          } catch {
            // Ignore invite errors here; UI will show if invalid.
          } finally {
            router.replace(buildInviteTarget(tenantId))
          }
        })()
      } else {
        const hasMembership = Array.isArray(storedSession?.memberships) && storedSession.memberships.length > 0
        const target = !hasMembership && isLandingPlan(plan) ? buildPreplanOnboardingTarget(plan) : '/app/inicio'
        router.replace(target)
      }
    }

    const next = params?.get('next')
    if (next && (next.startsWith('/app') || next.startsWith('/pago') || next.startsWith('/planes') || next.startsWith('/onboarding-negocio'))) {
      setNextPath(next)
    }
  }, [router])

  const showDemoIntro = selectedPlan === 'DEMO' && !inviteToken && !demoConfirmed

  const resolveNextPath = () => {
    if (inviteToken) {
      return buildInviteTarget(inviteTenantId)
    }

    if (selectedPlan) {
      return buildPreplanOnboardingTarget(selectedPlan)
    }

    return nextPath
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const response = await fetch(`${getApiBaseUrl()}/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, password }),
      })

      const payload = await response.json().catch(() => ({} as any))
      if (!response.ok) {
        throw new Error(mapStaffLoginError(response.status, payload))
      }

      persistAuthSession(payload)
      let hasMembership = Array.isArray(payload?.memberships) && payload.memberships.length > 0
      if (inviteToken && payload?.user?.id) {
        const result = await acceptInvitation(inviteToken, payload.user.id)
        if (result?.membership) {
          const nextMemberships = [
            result.membership,
            ...(payload?.memberships ?? []).filter((m: any) => m?.tenantId !== result.membership?.tenantId),
          ].map((membership: any) => ({
            membershipId: membership?.membershipId ?? membership?.id ?? '',
            role: membership?.role ?? '',
            tenantId: membership?.tenantId ?? membership?.tenant?.id ?? '',
            tenantSlug: membership?.tenantSlug ?? membership?.tenant?.slug ?? '',
            tenantName: membership?.tenantName ?? membership?.tenant?.name ?? '',
          }))
          updateStoredMemberships(nextMemberships)
          hasMembership = true
        }
        const synced = await syncMembershipsFromBackend()
        if (synced) {
          hasMembership = synced.hasMembership
        }
      }
      if (hasMembership) {
        router.replace('/app/inicio')
      } else {
        router.replace(resolveNextPath())
      }
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Error iniciando sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Scissors className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-display font-bold text-primary">GALTO</h1>
              <p className="text-xs text-muted-foreground">by MZ Consulting</p>
            </div>
          </div>
          <CardTitle className="text-2xl">Bienvenido de nuevo</CardTitle>
        <CardDescription>
          {showDemoIntro
            ? 'Antes de empezar, confirmá las condiciones'
            : inviteToken
              ? `Iniciá sesión para entrar al equipo ${inviteInfo?.tenantName ?? 'del negocio'}`
              : 'Ingresá a tu cuenta para gestionar tu barbería'}
        </CardDescription>
      </CardHeader>
        <CardContent className="space-y-4">
          {forcedNoAccount ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tu sesión no tiene un negocio asociado. Iniciá sesión nuevamente o registrate para continuar.
            </div>
          ) : null}
          {showDemoIntro ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
                <p className="font-medium">
                  Plan gratis de Galto
                </p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>El plan gratis permite solo 1 sucursal.</li>
                  <li>El plan gratis no vence.</li>
                  <li>Incluye agenda online, calendario, centro de cuentas y clientes.</li>
                  <li>El resto de los módulos queda deshabilitado hasta pasar a un plan pago.</li>
                </ul>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  if (typeof window === 'undefined') return
                  const params = new URLSearchParams(window.location.search)
                  params.set('plan', 'DEMO')
                  params.set('demoConfirmed', '1')
                  router.replace(`/registro?${params.toString()}`)
                }}
              >
                Confirmar y continuar
              </Button>
            </div>
          ) : null}

          {!showDemoIntro ? (
            <>
          {inviteToken ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {inviteInfo?.valid === false
                  ? 'Esta invitación no está disponible'
                  : `Invitación al equipo ${inviteInfo?.tenantName ?? ''}`}
              </p>
              <p className="text-muted-foreground mt-1">
                {inviteInfo?.reason === 'EXPIRED'
                  ? 'El link venció (24 hs). Pedí uno nuevo al dueño del negocio.'
                  : inviteInfo?.reason === 'USED'
                  ? 'El link ya fue usado. Pedí uno nuevo al dueño del negocio.'
                  : inviteInfo?.reason === 'INVALID'
                  ? 'El link es inválido. Verificá que esté completo.'
                  : 'Si no tenés cuenta, podés crearla desde este mismo flujo.'}
              </p>
            </div>
          ) : null}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Iniciando...' : 'Iniciar sesión'}
            </Button>
          </form>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">O continuar con</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full bg-transparent"
            disabled
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Olvidaste tu contraseña?{' '}
            <a href="#" className="text-primary hover:underline">
              Recuperar acceso
            </a>
          </p>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tenés cuenta?{' '}
            <Link
              href={buildRegisterHref(selectedPlan, inviteToken, inviteTenantId, demoConfirmed)}
              className="text-primary hover:underline"
            >
              Crear cuenta
            </Link>
          </p>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function mapStaffLoginError(status: number, payload: any) {
  const raw = String(Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message ?? '').toLowerCase()

  if (raw.includes('usuario no encontrado') || raw.includes('user not found') || raw.includes('email no encontrado')) {
    return 'No tenemos ese mail logueado, registrate para poder arrancar.'
  }

  if (
    raw.includes('contraseña') ||
    raw.includes('password') ||
    raw.includes('credenciales') ||
    raw.includes('invalid credentials') ||
    status === 401
  ) {
    return 'Tu contraseña está incorrecta.'
  }

  return 'No se pudo iniciar sesión.'
}

async function loadInvitationInfo(token: string): Promise<InviteInfo | null> {
  try {
    const response = await fetch(`/api/cuentas/invitations/info?token=${encodeURIComponent(token)}`)
    if (!response.ok) return null
    return (await response.json()) as InviteInfo
  } catch {
    return null
  }
}

function buildRegisterHref(
  plan: LandingPlan | null,
  inviteToken: string | null,
  inviteTenantId: string | null,
  demoConfirmed: boolean,
) {
  const params = new URLSearchParams()
  if (plan) params.set('plan', plan)
  if (plan === 'DEMO' && demoConfirmed) params.set('demoConfirmed', '1')
  if (inviteToken) params.set('invite', inviteToken)
  if (inviteTenantId) params.set('tenantId', inviteTenantId)
  const query = params.toString()
  return query ? `/registro?${query}` : '/registro'
}

async function acceptInvitation(token: string, userId: string): Promise<{ membership?: any } | null> {
  const response = await fetch('/api/cuentas/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, userId }),
  })

  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message
    throw new Error(message || 'No se pudo aceptar invitación')
  }
  return payload ?? null
}

async function syncMembershipsFromBackend(): Promise<{ hasMembership: boolean } | null> {
  const response = await fetch('/api/auth/memberships', { cache: 'no-store' })
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok) {
    return null
  }
  const memberships = Array.isArray(payload?.memberships) ? payload.memberships : []
  updateStoredMemberships(memberships)
  return { hasMembership: memberships.length > 0 }
}

function buildInviteTarget(_inviteTenantId: string | null) {
  return '/app/inicio'
}

function buildPreplanOnboardingTarget(plan: LandingPlan) {
  return `/onboarding-negocio?plan=${encodeURIComponent(plan)}`
}
