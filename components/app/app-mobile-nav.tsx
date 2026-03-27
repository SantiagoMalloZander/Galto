'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { cn } from '@/lib/utils'
import { CalendarDays, Home, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { AppSidebarContent } from './app-sidebar-content'
import { useBranchContext } from '@/hooks/use-branch-context'
import { canAccessBranchRoute } from '@/lib/branch-route-access'

export function AppMobileNav() {
  const pathname = usePathname()
  const { membershipRole, activeBranchPermissions } = useBranchContext()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [guideHref, setGuideHref] = React.useState<string | null>(null)

  const canAccessCalendar = canAccessBranchRoute('/app/calendario', membershipRole, activeBranchPermissions)
  const mainNavigation = [
    { href: '/app/inicio', icon: Home },
    { href: '/app/calendario', icon: CalendarDays, hidden: !canAccessCalendar },
  ].filter((item) => !item.hidden)

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
      <nav className="flex items-center justify-around h-16 px-2">
        {mainNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center justify-center h-11 w-14 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {guideHref === item.href ? (
                <span className="absolute -top-1 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                  Acá
                </span>
              ) : null}
              <item.icon className="h-5 w-5 shrink-0" />
            </Link>
          )
        })}

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              data-guide-mobile-menu="1"
              className="flex items-center justify-center h-11 w-14"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh]">
            <SheetHeader className="sr-only">
              <SheetTitle>Navegación de cuenta</SheetTitle>
              <SheetDescription>Accesos y opciones del panel.</SheetDescription>
            </SheetHeader>
            <AppSidebarContent onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  )
}
