'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Globe,
  Calendar,
  Users,
  Target,
  BarChart3,
  Gift,
  Trophy,
  Video,
  Scissors,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const allNavigation = [
  { name: 'Inicio', href: '/app/inicio', icon: Home },
  { name: 'Página de reservas', href: '/app/reservas', icon: Globe },
  { name: 'Calendario', href: '/app/calendario', icon: Calendar },
  { name: 'Centro de cuentas', href: '/app/cuentas', icon: Users },
  { name: 'Lead Finder', href: '/app/lead-finder', icon: Target },
  { name: 'Dashboard', href: '/app/dashboard', icon: BarChart3 },
  { name: 'Puntos de clientes', href: '/app/puntos', icon: Gift },
  { name: 'Recompensas', href: '/app/recompensas', icon: Trophy },
  { name: 'Panel de contenido', href: '/app/contenido', icon: Video },
]

export function AppSidebarContent() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
          <Scissors className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-primary">GALTO</h1>
          <p className="text-xs text-muted-foreground">by MZ Consulting</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {allNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="pt-4 border-t mt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-base font-semibold text-primary">AD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Admin Demo</p>
            <p className="text-xs text-muted-foreground">admin@galto.com</p>
          </div>
        </div>
        <Button variant="outline" className="w-full bg-transparent" asChild>
          <Link href="/login">
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Link>
        </Button>
      </div>
    </div>
  )
}
