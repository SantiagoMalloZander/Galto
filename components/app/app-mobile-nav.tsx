'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Globe,
  Calendar,
  BarChart3,
  Menu,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { AppSidebarContent } from './app-sidebar-content'

const mainNavigation = [
  { name: 'Inicio', href: '/app/inicio', icon: Home },
  { name: 'Reservas', href: '/app/reservas', icon: Globe },
  { name: 'Calendario', href: '/app/calendario', icon: Calendar },
  { name: 'Dashboard', href: '/app/dashboard', icon: BarChart3 },
]

export function AppMobileNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
      <nav className="flex items-center justify-around h-16 px-2">
        {mainNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-0 flex-1',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="text-xs font-medium truncate">{item.name}</span>
            </Link>
          )
        })}
        
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center justify-center gap-1 h-auto py-2 px-3 flex-1"
            >
              <Menu className="h-5 w-5" />
              <span className="text-xs font-medium">Más</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh]">
            <AppSidebarContent />
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  )
}
