import {
  BarChart3,
  Calendar,
  CircleAlert,
  Boxes,
  ContactRound,
  CreditCard,
  Gift,
  Globe,
  Headset,
  Home,
  Landmark,
  MessageCircle,
  Target,
  Trophy,
  Users,
  Video,
} from 'lucide-react';
import type { AppFeatureKey } from './entitlements';

export interface AppNavItem {
  name: string;
  href: string;
  icon: any;
  feature?: AppFeatureKey;
  description?: string;
  color?: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { name: 'Inicio', href: '/app/inicio', icon: Home },
  {
    name: 'Planes y pagos',
    href: '/app/planes',
    icon: CreditCard,
    description: 'Elegí plan gratis o plan pago y seguí el estado de activación',
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    name: 'Información del negocio',
    href: '/app/reservas',
    icon: CircleAlert,
    feature: 'reservas',
    description: 'Configurá datos operativos por sucursal',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    name: 'Página web de reservas',
    href: '/app/pagina-web',
    icon: Globe,
    feature: 'reservas',
    description: 'Configurá dominio, nota pública y contenido visual',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    name: 'Integraciones',
    href: '/app/integraciones',
    icon: MessageCircle,
    feature: 'reservas',
    description: 'Conectá WPP, Mercado Pago y ChatGPT con tu negocio',
    color: 'text-violet-600 bg-violet-50',
  },
  {
    name: 'Inventario',
    href: '/app/inventario',
    icon: Boxes,
    feature: 'calendario',
    description: 'Gestioná productos físicos y stock por sucursal',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    name: 'Gastos',
    href: '/app/gastos',
    icon: Landmark,
    feature: 'dashboard',
    description: 'Cargá gastos fijos y variables por sucursal',
    color: 'text-rose-600 bg-rose-50',
  },
  {
    name: 'Calendario',
    href: '/app/calendario',
    icon: Calendar,
    feature: 'calendario',
    description: 'Visualizá y gestioná reservas, cobros y atención desde una sola vista',
    color: 'text-green-600 bg-green-50',
  },
  {
    name: 'Centro de cuentas',
    href: '/app/cuentas',
    icon: Users,
    feature: 'cuentas',
    description: 'Administrá usuarios, roles y permisos',
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    name: 'Clientes',
    href: '/app/clientes',
    icon: ContactRound,
    feature: 'clientes',
    description: 'Buscá, revisá y borrá clientes del negocio',
    color: 'text-fuchsia-600 bg-fuchsia-50',
  },
  {
    name: 'Soporte',
    href: '/app/soporte',
    icon: Headset,
    description: 'Comprá horas de soporte y organizá la sesión',
    color: 'text-violet-600 bg-violet-50',
  },
  {
    name: 'Lead Finder',
    href: '/app/lead-finder',
    icon: Target,
    feature: 'lead_finder',
    description: 'Enviá campañas para llenar huecos en tu agenda',
    color: 'text-orange-600 bg-orange-50',
  },
  {
    name: 'Dashboard',
    href: '/app/dashboard',
    icon: BarChart3,
    feature: 'dashboard',
    description: 'Analizá métricas y rendimiento de tu negocio',
    color: 'text-cyan-600 bg-cyan-50',
  },
  {
    name: 'Puntos de clientes',
    href: '/app/puntos',
    icon: Gift,
    feature: 'puntos',
    description: 'Gestioná programa de lealtad y recompensas',
    color: 'text-pink-600 bg-pink-50',
  },
  {
    name: 'Recompensas',
    href: '/app/recompensas',
    icon: Trophy,
    feature: 'recompensas',
    description: 'Creá incentivos y premiá a tu equipo',
    color: 'text-yellow-600 bg-yellow-50',
  },
  {
    name: 'Panel de contenido',
    href: '/app/contenido',
    icon: Video,
    feature: 'contenido',
    description: 'Seguí el contenido creado por empleados',
    color: 'text-red-600 bg-red-50',
  },
];
