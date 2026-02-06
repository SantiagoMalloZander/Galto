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

const navigation = [
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

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-6 border-b">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <Scissors className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-display font-bold text-primary">GALTO</h1>
          <p className="text-xs text-muted-foreground">by MZ Consulting</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">AD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Admin Demo</p>
            <p className="text-xs text-muted-foreground truncate">admin@galto.com</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full bg-transparent" asChild>
          <Link href="/login">
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Link>
        </Button>
      </div>
    </div>
  )
}
