'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Globe,
  Calendar,
  Users,
  Target,
  BarChart3,
  Gift,
  Trophy,
  Video,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const modules = [
  {
    name: 'Personalizá tu página de reservas',
    description: 'Configurá servicios, trabajadores y horarios por sucursal',
    href: '/app/reservas',
    icon: Globe,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    name: 'Calendario',
    description: 'Visualizá y gestioná todas las reservas',
    href: '/app/calendario',
    icon: Calendar,
    color: 'text-green-600 bg-green-50',
  },
  {
    name: 'Centro de cuentas',
    description: 'Administrá usuarios, roles y permisos',
    href: '/app/cuentas',
    icon: Users,
    color: 'text-purple-600 bg-purple-50',
  },
  {
    name: 'Lead Finder',
    description: 'Enviá campañas para llenar huecos en tu agenda',
    href: '/app/lead-finder',
    icon: Target,
    color: 'text-orange-600 bg-orange-50',
  },
  {
    name: 'Dashboard',
    description: 'Analizá métricas y rendimiento de tu negocio',
    href: '/app/dashboard',
    icon: BarChart3,
    color: 'text-cyan-600 bg-cyan-50',
  },
  {
    name: 'Puntos de clientes',
    description: 'Gestioná programa de lealtad y recompensas',
    href: '/app/puntos',
    icon: Gift,
    color: 'text-pink-600 bg-pink-50',
  },
  {
    name: 'Recompensas para empleados',
    description: 'Creá incentivos y premiá a tu equipo',
    href: '/app/recompensas',
    icon: Trophy,
    color: 'text-yellow-600 bg-yellow-50',
  },
  {
    name: 'Panel de contenido',
    description: 'Seguí el contenido creado por empleados',
    href: '/app/contenido',
    icon: Video,
    color: 'text-red-600 bg-red-50',
  },
]

const quickGuide = [
  'Configurá tu página de reservas con servicios y horarios',
  'Agregá a tu equipo en Centro de cuentas',
  'Empezá a recibir reservas automáticamente',
]

export default function InicioPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
          ¡Bienvenido a GALTO!
        </h1>
        <p className="text-muted-foreground text-lg">
          Tu centro de gestión para hacer crecer tu barbería
        </p>
      </div>

      {/* Quick Guide */}
      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Guía rápida para empezar</CardTitle>
          <CardDescription>
            Completá estos pasos para configurar tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {quickGuide.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Modules Grid */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Módulos disponibles</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((module) => (
          <Link key={module.name} href={module.href}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/20">
              <CardHeader className="pb-3">
                <div className={`h-12 w-12 rounded-lg ${module.color} flex items-center justify-center mb-3`}>
                  <module.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-base leading-tight">
                  {module.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {module.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
