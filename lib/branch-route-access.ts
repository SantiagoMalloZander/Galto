export type MembershipRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | string | null;

type RoutePermissionRule = {
  route: string;
  anyOf: string[];
};

const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  { route: '/app/reservas', anyOf: ['BRANCH_READ', 'BRANCH_WRITE'] },
  { route: '/app/pagina-web', anyOf: ['SERVICES_READ', 'SERVICES_WRITE'] },
  { route: '/app/integraciones', anyOf: ['SERVICES_READ', 'SERVICES_WRITE'] },
  { route: '/app/inventario', anyOf: ['INVENTORY_READ', 'INVENTORY_WRITE'] },
  {
    route: '/app/gastos',
    anyOf: ['BRANCH_READ', 'BRANCH_WRITE', 'SERVICES_READ', 'SERVICES_WRITE', 'INVENTORY_READ', 'INVENTORY_WRITE'],
  },
  { route: '/app/calendario', anyOf: ['APPOINTMENTS_READ', 'APPOINTMENTS_WRITE'] },
  { route: '/app/clientes', anyOf: ['CUSTOMERS_READ', 'CUSTOMERS_WRITE'] },
  { route: '/app/dashboard', anyOf: ['DASHBOARD_READ'] },
  { route: '/app/puntos', anyOf: ['CUSTOMERS_READ', 'CUSTOMERS_WRITE'] },
  { route: '/app/recompensas', anyOf: ['CAMPAIGNS_READ', 'CAMPAIGNS_WRITE'] },
  { route: '/app/contenido', anyOf: ['CAMPAIGNS_READ', 'CAMPAIGNS_WRITE'] },
];

function matchRule(pathname: string) {
  return ROUTE_PERMISSION_RULES.find((rule) => pathname === rule.route || pathname.startsWith(`${rule.route}/`));
}

export function canAccessBranchRoute(
  pathname: string,
  role: MembershipRole,
  activeBranchPermissions: string[] | null | undefined,
) {
  const rule = matchRule(pathname);
  if (!rule) return true;
  if (role === 'OWNER') return true;
  if (!Array.isArray(activeBranchPermissions) || activeBranchPermissions.length === 0) return false;
  const granted = new Set(activeBranchPermissions);
  return rule.anyOf.some((permission) => granted.has(permission));
}
