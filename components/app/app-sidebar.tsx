'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, LogOut, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clearStoredAuth } from '@/lib/auth'
import { APP_NAV_ITEMS } from '@/lib/app-features'
import { useAuthSession } from '@/hooks/use-auth-session'
import { useBranchContext } from '@/hooks/use-branch-context'
import { canAccessBranchRoute } from '@/lib/branch-route-access'

const CONFIG_SECTION_HREFS = new Set([
  '/app/planes',
  '/app/reservas',
  '/app/pagina-web',
  '/app/integraciones',
  '/app/inventario',
  '/app/gastos',
  '/app/cuentas',
  '/app/clientes',
  '/app/soporte',
])

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { session, canAccess } = useAuthSession()
  const { hasMultipleBranches, branches, activeBranchId, setActiveBranchId, membershipRole, activeBranchPermissions } = useBranchContext()
  const [guideHref, setGuideHref] = React.useState<string | null>(null)
  const [configOpen, setConfigOpen] = React.useState(false)

  const navigation = APP_NAV_ITEMS.filter((item) => {
    if (item.href === '/app/planes' && membershipRole && membershipRole !== 'OWNER') {
      return false
    }
    return (
      (!item.feature || canAccess(item.feature)) &&
      canAccessBranchRoute(item.href, membershipRole, activeBranchPermissions)
    )
  })
  const configItems = navigation.filter((item) => CONFIG_SECTION_HREFS.has(item.href))
  const mainItems = navigation.filter((item) => !CONFIG_SECTION_HREFS.has(item.href))

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const syncGuide = () => {
      const raw = window.localStorage.getItem('galto_guide_target')
      if (!raw) {
        setGuideHref(null)
        return
      }
      try {
        const parsed = JSON.parse(raw) as { href?: string | null; expiresAt?: number }
        if (!parsed.href || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
          setGuideHref(null)
          return
        }
        setGuideHref(parsed.href)
      } catch {
        setGuideHref(null)
      }
    }

    const onCustom = () => syncGuide()
    syncGuide()
    window.addEventListener('storage', syncGuide)
    window.addEventListener('galto-guide-target', onCustom as EventListener)
    const intervalId = window.setInterval(syncGuide, 600)

    return () => {
      window.removeEventListener('storage', syncGuide)
      window.removeEventListener('galto-guide-target', onCustom as EventListener)
      window.clearInterval(intervalId)
    }
  }, [])

  const handleLogout = () => {
    clearStoredAuth()
    router.push('/login')
  }

  const initials = (session?.user?.fullName ?? session?.user?.email ?? 'Usuario')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col">
      <div className="h-16 flex items-center gap-2 px-6 border-b">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
          <Image src="/logogalto.png" alt="GALTO" width={32} height={32} className="h-8 w-8 object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-display font-bold text-primary">GALTO</h1>
          <p className="text-xs text-muted-foreground">by MZ Consulting</p>
        </div>
      </div>

      {hasMultipleBranches ? (
        <div className="px-3 py-3 border-b">
          <label className="text-[11px] text-muted-foreground px-1">Cambiar sucursal</label>
          <select
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={activeBranchId ?? ''}
            onChange={(event) => void setActiveBranchId(event.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {mainItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  data-guide-href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.name}</span>
                  {guideHref === item.href ? (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-current border border-white/30">
                      Acá
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
          {configItems.length > 0 ? (
            <li className="pt-2 mt-2 border-t">
              <button
                type="button"
                onClick={() => setConfigOpen((current) => !current)}
                data-guide-config-toggle="1"
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Settings2 className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">Configuración</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', configOpen ? 'rotate-180' : '')} />
              </button>
              {configOpen ? (
                <ul className="mt-1 ml-2 space-y-1 border-l pl-2">
                  {configItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          data-guide-href={item.href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          ) : null}
        </ul>
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{session?.user?.fullName ?? 'Usuario'}</p>
            <p className="text-xs text-muted-foreground truncate">{session?.user?.email ?? '-'}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
