'use client'

import React from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiBaseUrl } from '@/lib/api'
import { getStoredAccessToken, getStoredAuthSession, persistAuthSession, updateStoredMemberships } from '@/lib/auth'
import { isLandingPlan, type LandingPlan } from '@/lib/onboarding-profile'

type InviteInfo = {
  valid: boolean
  tenantId?: string
  tenantName?: string
  reason?: 'OK' | 'INVALID' | 'USED' | 'EXPIRED'
}

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<LandingPlan | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteTenantId, setInviteTenantId] = useState<string | null>(null)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const plan = params?.get('plan')
    const invite = params?.get('invite')
    const tenantId = params?.get('tenantId')
    if (isLandingPlan(plan)) {
      setSelectedPlan(plan)
    }
    if (invite) {
      setInviteToken(invite)
    }
    if (tenantId) {
      setInviteTenantId(tenantId)
    }

    if (invite) {
      void loadInvitationInfo(invite).then((info) => setInviteInfo(info))
    }

    if (getStoredAccessToken()) {
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
  }, [router])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const response = await fetch(`${getApiBaseUrl()}/auth/staff/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: fullName || undefined,
          email: normalizedEmail,
          password,
        }),
      })

      const payload = await response.json().catch(() => ({} as any))
      if (!response.ok) {
        const message =
          (Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message) ||
          'No se pudo crear la cuenta'
        throw new Error(message)
      }

      persistAuthSession(payload)
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
        }
        await syncMembershipsFromBackend()
      }

      const target = inviteToken
        ? buildInviteTarget(inviteTenantId)
        : selectedPlan
          ? buildPreplanOnboardingTarget(selectedPlan)
            : '/app/inicio'
      router.replace(target)
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Error creando la cuenta')
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
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>
            {inviteToken
              ? `Creá tu cuenta para entrar al equipo ${inviteInfo?.tenantName ?? 'del negocio'}`
              : 'Registrate con email y contraseña para empezar'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
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
                  : 'Completá el registro y vas a entrar directo al inicio del negocio.'}
              </p>
            </div>
          ) : null}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo (opcional)</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Tu nombre"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

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
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link
              href={buildLoginHref(selectedPlan, inviteToken, inviteTenantId)}
              className="text-primary hover:underline"
            >
              Iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function buildLoginHref(plan: LandingPlan | null, inviteToken: string | null, inviteTenantId: string | null) {
  const params = new URLSearchParams()
  if (plan) params.set('plan', plan)
  if (inviteToken) params.set('invite', inviteToken)
  if (inviteTenantId) params.set('tenantId', inviteTenantId)
  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}

function buildInviteTarget(_inviteTenantId: string | null) {
  return '/app/inicio'
}

function buildPreplanOnboardingTarget(plan: LandingPlan) {
  return `/onboarding-negocio?plan=${encodeURIComponent(plan)}`
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

async function syncMembershipsFromBackend(): Promise<void> {
  const response = await fetch('/api/auth/memberships', { cache: 'no-store' })
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok) {
    return
  }
  const memberships = Array.isArray(payload?.memberships) ? payload.memberships : []
  updateStoredMemberships(memberships)
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
