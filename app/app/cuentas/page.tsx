'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, KeyRound, Save, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { useAuthSession } from '@/hooks/use-auth-session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type MembershipOption = {
  membershipId: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

type Branch = {
  id: string;
  name: string;
  slug: string;
};

type BranchAccess = {
  branchId: string;
  permissions: string[];
};

type ScheduleRow = {
  dayOfWeek: number;
  startTimeMin: number;
  endTimeMin: number;
};

type Member = {
  membershipId: string;
  role: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
  workerType: 'OWNER' | 'TOTAL_POWER' | 'ADMIN_GENERAL' | 'ADMIN_BRANCH' | 'WORKER';
  userId: string;
  email: string;
  fullName: string | null;
  profile: {
    instagram: string | null;
    bio: string | null;
    personalPhone: string | null;
  };
  commissions: {
    inventoryPercent: number | null;
    fixedCents: number | null;
    categoryPercents: Array<{
      categoryId: string;
      percent: number;
    }>;
  };
  branchAccesses: BranchAccess[];
  schedules: Array<{
    branchId: string;
    employeeId: string;
    fullName: string;
    serviceIds: string[];
    schedules: ScheduleRow[];
  }>;
};

type ExternalEmployee = {
  employeeId: string;
  branchId: string;
  branchName: string;
  fullName: string;
  isActive: boolean;
  profile: {
    instagram: string | null;
    bio: string | null;
    personalPhone: string | null;
  };
  serviceIds: string[];
  schedules: Array<{
    branchId: string;
    employeeId: string;
    fullName: string;
    serviceIds: string[];
    schedules: ScheduleRow[];
  }>;
};

type Invitation = {
  id: string;
  token: string;
  invitedEmail: string | null;
  role: 'MANAGER' | 'EMPLOYEE';
  workerType: 'TOTAL_POWER' | 'ADMIN_GENERAL' | 'ADMIN_BRANCH' | 'WORKER';
  branchAccesses: BranchAccess[];
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
};

type ContextPayload = {
  tenant: { id: string; slug: string; name: string } | null;
  actor: {
    membershipId: string;
    role: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
    canManageAccounts: boolean;
  };
  branches: Branch[];
  serviceCatalog: Array<{
    id: string;
    branchId: string;
    name: string;
    isActive: boolean;
    categoryId: string | null;
    categoryName: string | null;
  }>;
  serviceCategories: Array<{
    id: string;
    branchId: string;
    branchName: string;
    name: string;
    sortOrder: number;
  }>;
  commissions: {
    global: {
      inventoryPercent: number | null;
      fixedCents: number | null;
      categoryPercents: Array<{
        categoryId: string;
        percent: number;
      }>;
    };
  };
  permissionsCatalog: string[];
  members: Member[];
  externalEmployees: ExternalEmployee[];
  invitations: Invitation[];
};

type InviteWorkerType = 'TOTAL_POWER' | 'ADMIN_GENERAL' | 'ADMIN_BRANCH' | 'WORKER';
type AccessLevel = 'NONE' | 'READ' | 'WRITE';

type ModulePermissionId =
  | 'billing'
  | 'business_info'
  | 'booking_page'
  | 'inventory'
  | 'calendar'
  | 'accounts'
  | 'support'
  | 'dashboard'
  | 'customer_points'
  | 'staff_rewards'
  | 'content_panel';

type ModuleLevelState = Record<ModulePermissionId, AccessLevel>;

type ModulePermissionConfig = {
  id: ModulePermissionId;
  label: string;
  description: string;
  readPermissions: string[];
  writePermissions: string[];
  ownerOnly?: boolean;
};

const MODULE_PERMISSION_CONFIG: ModulePermissionConfig[] = [
  {
    id: 'billing',
    label: 'Planes y pagos',
    description: 'Gestión de plan, renovaciones y pagos.',
    readPermissions: [],
    writePermissions: [],
    ownerOnly: true,
  },
  {
    id: 'business_info',
    label: 'Información del negocio',
    description: 'Datos operativos y configuración base de sucursal.',
    readPermissions: ['BRANCH_READ'],
    writePermissions: ['BRANCH_WRITE'],
  },
  {
    id: 'booking_page',
    label: 'Página de reservas',
    description: 'Configuración web pública y catálogo de servicios.',
    readPermissions: ['SERVICES_READ'],
    writePermissions: ['SERVICES_WRITE'],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    description: 'Productos físicos, stock y alertas por sucursal.',
    readPermissions: ['INVENTORY_READ'],
    writePermissions: ['INVENTORY_WRITE'],
  },
  {
    id: 'calendar',
    label: 'Calendario',
    description: 'Visualización y gestión completa de turnos, cobros y atención.',
    readPermissions: ['APPOINTMENTS_READ'],
    writePermissions: ['APPOINTMENTS_WRITE'],
  },
  {
    id: 'accounts',
    label: 'Centro de cuentas',
    description: 'Gestión de equipo y permisos.',
    readPermissions: ['EMPLOYEES_READ'],
    writePermissions: ['EMPLOYEES_WRITE'],
  },
  {
    id: 'support',
    label: 'Soporte',
    description: 'Gestión de solicitudes de soporte.',
    readPermissions: [],
    writePermissions: [],
    ownerOnly: true,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Métricas y reportes de negocio.',
    readPermissions: ['DASHBOARD_READ'],
    writePermissions: [],
  },
  {
    id: 'customer_points',
    label: 'Puntos de clientes',
    description: 'Consulta y edición del módulo de fidelización.',
    readPermissions: ['CUSTOMERS_READ'],
    writePermissions: ['CUSTOMERS_WRITE'],
  },
  {
    id: 'staff_rewards',
    label: 'Recompensas de trabajadores',
    description: 'Objetivos y ranking del equipo.',
    readPermissions: ['CAMPAIGNS_READ'],
    writePermissions: ['CAMPAIGNS_WRITE'],
  },
  {
    id: 'content_panel',
    label: 'Panel de contenido',
    description: 'Competiciones y links de contenido.',
    readPermissions: ['CAMPAIGNS_READ'],
    writePermissions: ['CAMPAIGNS_WRITE'],
  },
];

const DEFAULT_MODULE_LEVELS: ModuleLevelState = {
  billing: 'NONE',
  business_info: 'NONE',
  booking_page: 'NONE',
  inventory: 'NONE',
  calendar: 'NONE',
  accounts: 'NONE',
  support: 'NONE',
  dashboard: 'NONE',
  customer_points: 'NONE',
  staff_rewards: 'NONE',
  content_panel: 'NONE',
};

const WORKER_TYPE_LABEL: Record<Member['workerType'], string> = {
  OWNER: 'Owner',
  TOTAL_POWER: 'Total Power',
  ADMIN_GENERAL: 'Administrador general',
  ADMIN_BRANCH: 'Administrador de sucursal',
  WORKER: 'Trabajador',
};

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, hour) => hour);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => minute);

function toMinutes(hour: number, minute: number) {
  return hour * 60 + minute;
}

function moduleLevelsToPermissions(levels: ModuleLevelState): string[] {
  const output = new Set<string>();
  for (const module of MODULE_PERMISSION_CONFIG) {
    const level = levels[module.id];
    if (level === 'READ' || level === 'WRITE') {
      for (const permission of module.readPermissions) output.add(permission);
    }
    if (level === 'WRITE') {
      for (const permission of module.writePermissions) output.add(permission);
    }
  }
  return [...output];
}

function moduleLevelsFromPermissions(permissions: string[]): ModuleLevelState {
  const permissionSet = new Set(permissions);
  const next: ModuleLevelState = { ...DEFAULT_MODULE_LEVELS };
  for (const module of MODULE_PERMISSION_CONFIG) {
    if (module.readPermissions.length === 0 && module.writePermissions.length === 0) {
      next[module.id] = 'NONE';
      continue;
    }
    const hasWrite = module.writePermissions.some((permission) => permissionSet.has(permission));
    const hasRead = module.readPermissions.some((permission) => permissionSet.has(permission));
    next[module.id] = hasWrite ? 'WRITE' : hasRead ? 'READ' : 'NONE';
  }
  return next;
}

function defaultModuleLevelsForType(workerType: InviteWorkerType): ModuleLevelState {
  if (workerType === 'TOTAL_POWER') {
    return {
      ...DEFAULT_MODULE_LEVELS,
      business_info: 'WRITE',
      booking_page: 'WRITE',
      inventory: 'WRITE',
      calendar: 'WRITE',
      accounts: 'WRITE',
      dashboard: 'READ',
      customer_points: 'WRITE',
      staff_rewards: 'WRITE',
      content_panel: 'WRITE',
    };
  }
  if (workerType === 'ADMIN_GENERAL') {
    return {
      ...DEFAULT_MODULE_LEVELS,
      business_info: 'WRITE',
      booking_page: 'WRITE',
      inventory: 'WRITE',
      calendar: 'WRITE',
      accounts: 'WRITE',
      dashboard: 'READ',
      customer_points: 'WRITE',
      staff_rewards: 'WRITE',
      content_panel: 'WRITE',
    };
  }
  if (workerType === 'ADMIN_BRANCH') {
    return {
      ...DEFAULT_MODULE_LEVELS,
      business_info: 'WRITE',
      booking_page: 'WRITE',
      inventory: 'WRITE',
      calendar: 'WRITE',
      accounts: 'WRITE',
      dashboard: 'READ',
      customer_points: 'WRITE',
      staff_rewards: 'READ',
      content_panel: 'READ',
    };
  }
  return {
    ...DEFAULT_MODULE_LEVELS,
    inventory: 'READ',
    calendar: 'WRITE',
    customer_points: 'WRITE',
    staff_rewards: 'READ',
    content_panel: 'READ',
  };
}

export default function CuentasPage() {
  const { session } = useAuthSession();

  const [memberships, setMemberships] = useState<MembershipOption[]>([]);
  const [tenantId, setTenantId] = useState('');
  const selectedTenant = useMemo(
    () => memberships.find((membership) => membership.tenantId === tenantId) ?? memberships[0] ?? null,
    [memberships, tenantId],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingMembershipId, setDeletingMembershipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [clientOrigin, setClientOrigin] = useState('');

  const [context, setContext] = useState<ContextPayload | null>(null);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>('');
  const [selectedExternalEmployeeId, setSelectedExternalEmployeeId] = useState<string>('');

  const [inviteType, setInviteType] = useState<InviteWorkerType>('WORKER');
  const [inviteBranchIds, setInviteBranchIds] = useState<string[]>([]);
  const [inviteModuleLevelsByBranch, setInviteModuleLevelsByBranch] = useState<Record<string, ModuleLevelState>>({});
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [externalBranchId, setExternalBranchId] = useState('');
  const [externalFullName, setExternalFullName] = useState('');
  const [externalServiceIds, setExternalServiceIds] = useState<string[]>([]);
  const [externalIsActive, setExternalIsActive] = useState(true);
  const [savingExternal, setSavingExternal] = useState(false);
  const [savingExternalConfig, setSavingExternalConfig] = useState(false);
  const [editExternalFullName, setEditExternalFullName] = useState('');
  const [editExternalIsActive, setEditExternalIsActive] = useState(true);

  const [editRole, setEditRole] = useState<'MANAGER' | 'EMPLOYEE'>('EMPLOYEE');
  const [editModuleLevelsByBranch, setEditModuleLevelsByBranch] = useState<Record<string, ModuleLevelState>>({});
  const [editInstagram, setEditInstagram] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSchedules, setEditSchedules] = useState<Record<string, ScheduleRow[]>>({});
  const [editServiceIdsByBranch, setEditServiceIdsByBranch] = useState<Record<string, string[]>>({});
  const [editInventoryCommissionPercent, setEditInventoryCommissionPercent] = useState('');
  const [editFixedSalaryArs, setEditFixedSalaryArs] = useState('');
  const [editCategoryCommissionById, setEditCategoryCommissionById] = useState<Record<string, string>>({});

  const [globalInventoryCommissionPercent, setGlobalInventoryCommissionPercent] = useState('');
  const [globalFixedSalaryArs, setGlobalFixedSalaryArs] = useState('');
  const [globalCategoryCommissionById, setGlobalCategoryCommissionById] = useState<Record<string, string>>({});
  const [savingGlobalCommissions, setSavingGlobalCommissions] = useState(false);

  const safeCopy = async (rawValue: string, okMessage: string) => {
    const value = ensurePublicUrl(rawValue, clientOrigin);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        setStatusMessage(okMessage);
        return;
      } catch {
        // fallback below
      }
    }
    if (legacyCopy(value)) {
      setStatusMessage(okMessage);
      return;
    }
    setStatusMessage(`Copiá manualmente este link: ${value}`);
  };

  useEffect(() => {
    setMemberships(session?.memberships ?? []);
  }, [session?.memberships]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (memberships.length > 0) return;

    let cancelled = false;
    const loadMemberships = async () => {
      try {
        const response = await fetch(`/api/reservas/tenants?userId=${encodeURIComponent(session.user.id)}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;

        const nextMemberships = (payload?.tenants ?? []) as MembershipOption[];
        setMemberships(nextMemberships);
        if (!tenantId && nextMemberships[0]?.tenantId) {
          setTenantId(nextMemberships[0].tenantId);
        }
      } catch {
        // keep graceful fallback in UI
      }
    };

    void loadMemberships();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, memberships.length, tenantId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setClientOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!tenantId && memberships[0]?.tenantId) {
      setTenantId(memberships[0].tenantId);
    }
  }, [tenantId, memberships]);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    if (!tenantId) {
      setLoading(false);
      return;
    }
    void loadContext(tenantId);
  }, [session?.user?.id, tenantId]);

  const selectedMember = useMemo(
    () => context?.members.find((member) => member.membershipId === selectedMembershipId) ?? null,
    [context?.members, selectedMembershipId],
  );
  const selectedExternalEmployee = useMemo(
    () => context?.externalEmployees.find((employee) => employee.employeeId === selectedExternalEmployeeId) ?? null,
    [context?.externalEmployees, selectedExternalEmployeeId],
  );

  const canManage = context?.actor?.canManageAccounts ?? false;
  const isEditingSelf = Boolean(
    selectedMember && session?.user?.id && selectedMember.userId === session.user.id,
  );
  const isOwnerSelected = selectedMember?.role === 'OWNER';
  const canEditOwnerSelf = Boolean(isOwnerSelected && isEditingSelf);
  const canEditAdministrativeFields = canManage && !isEditingSelf;
  const canEditProfile = Boolean(selectedMember && (canEditAdministrativeFields || isEditingSelf));
  const canEditOwnServices = Boolean(selectedMember && (canEditAdministrativeFields || isEditingSelf));
  const canEditOwnSchedules = Boolean(selectedMember && (canEditAdministrativeFields || isEditingSelf));
  const isPaidPlan = Boolean(session?.accountAccess?.isPaid);

  async function loadContext(targetTenantId: string) {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/cuentas/context?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(targetTenantId)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo cargar centro de cuentas');
      }

      const data = payload as ContextPayload;
      setContext(data);
      hydrateGlobalCommissions(data);

      const preservedMember = data.members.find((member) => member.membershipId === selectedMembershipId) ?? null;
      const preservedExternal =
        data.externalEmployees.find((employee) => employee.employeeId === selectedExternalEmployeeId) ?? null;

      if (preservedMember) {
        setSelectedMembershipId(preservedMember.membershipId);
        setSelectedExternalEmployeeId('');
        hydrateEditor(preservedMember, data.branches);
      } else if (preservedExternal) {
        setSelectedMembershipId('');
        setSelectedExternalEmployeeId(preservedExternal.employeeId);
        hydrateExternalEditor(preservedExternal, data.branches);
      } else if (data.members[0]) {
        setSelectedMembershipId(data.members[0].membershipId);
        setSelectedExternalEmployeeId('');
        hydrateEditor(data.members[0], data.branches);
      } else if (data.externalEmployees[0]) {
        setSelectedMembershipId('');
        setSelectedExternalEmployeeId(data.externalEmployees[0].employeeId);
        hydrateExternalEditor(data.externalEmployees[0], data.branches);
      } else {
        setSelectedMembershipId('');
        setSelectedExternalEmployeeId('');
        hydrateEditor(null, data.branches);
      }

      if (data.branches.length) {
        const defaultLevels = defaultModuleLevelsForType(inviteType);
        const inviteLevelsMap: Record<string, ModuleLevelState> = {};
        for (const branch of data.branches) {
          inviteLevelsMap[branch.id] = { ...defaultLevels };
        }
        setInviteModuleLevelsByBranch(inviteLevelsMap);
        if (inviteType === 'ADMIN_GENERAL' || inviteType === 'TOTAL_POWER') {
          setInviteBranchIds(data.branches.map((branch) => branch.id));
        } else if (!inviteBranchIds.length) {
          setInviteBranchIds([data.branches[0].id]);
        }

        if (!externalBranchId) {
          setExternalBranchId(data.branches[0].id);
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }

  function hydrateEditor(member: Member | null, branches: Branch[]) {
    if (!member) {
      setEditRole('EMPLOYEE');
      setEditModuleLevelsByBranch({});
      setEditInstagram('');
      setEditBio('');
      setEditPhone('');
      setEditSchedules({});
      setEditServiceIdsByBranch({});
      setEditInventoryCommissionPercent('');
      setEditFixedSalaryArs('');
      setEditCategoryCommissionById({});
      return;
    }

    setEditRole(member.role === 'MANAGER' ? 'MANAGER' : 'EMPLOYEE');

    const moduleLevelsMap: Record<string, ModuleLevelState> = {};
    for (const branch of branches) {
      moduleLevelsMap[branch.id] = { ...DEFAULT_MODULE_LEVELS };
    }
    for (const access of member.branchAccesses) {
      moduleLevelsMap[access.branchId] = moduleLevelsFromPermissions(access.permissions);
    }
    setEditModuleLevelsByBranch(moduleLevelsMap);

    setEditInstagram(member.profile.instagram ?? '');
    setEditBio(member.profile.bio ?? '');
    setEditPhone(member.profile.personalPhone ?? '');

    const schedules: Record<string, ScheduleRow[]> = {};
    const servicesByBranch: Record<string, string[]> = {};
    for (const row of member.schedules) {
      schedules[row.branchId] = [...row.schedules];
      servicesByBranch[row.branchId] = [...(row.serviceIds ?? [])];
    }
    setEditSchedules(schedules);
    setEditServiceIdsByBranch(servicesByBranch);
    setEditInventoryCommissionPercent(
      member.commissions?.inventoryPercent === null || member.commissions?.inventoryPercent === undefined
        ? ''
        : String(member.commissions.inventoryPercent),
    );
    setEditFixedSalaryArs(
      member.commissions?.fixedCents === null || member.commissions?.fixedCents === undefined
        ? ''
        : centsToArsInput(member.commissions.fixedCents),
    );

    const categoryById: Record<string, string> = {};
    for (const row of member.commissions?.categoryPercents ?? []) {
      categoryById[row.categoryId] = String(row.percent);
    }
    setEditCategoryCommissionById(categoryById);
  }

  function hydrateExternalEditor(employee: ExternalEmployee | null, branches: Branch[]) {
    if (!employee) {
      setEditExternalFullName('');
      setEditExternalIsActive(true);
      setEditInstagram('');
      setEditBio('');
      setEditPhone('');
      setEditSchedules({});
      setEditServiceIdsByBranch({});
      return;
    }

    setEditExternalFullName(employee.fullName ?? '');
    setEditExternalIsActive(Boolean(employee.isActive));
    setEditInstagram(employee.profile?.instagram ?? '');
    setEditBio(employee.profile?.bio ?? '');
    setEditPhone(employee.profile?.personalPhone ?? '');

    const schedules: Record<string, ScheduleRow[]> = {};
    for (const branch of branches) {
      schedules[branch.id] = [];
    }
    for (const row of employee.schedules ?? []) {
      schedules[row.branchId] = [...(row.schedules ?? [])];
    }
    if (!schedules[employee.branchId]) {
      schedules[employee.branchId] = [];
    }
    setEditSchedules(schedules);
    setEditServiceIdsByBranch({
      [employee.branchId]: [...(employee.serviceIds ?? [])],
    });
  }

  function hydrateGlobalCommissions(data: ContextPayload) {
    const global = data.commissions?.global;
    setGlobalInventoryCommissionPercent(
      global?.inventoryPercent === null || global?.inventoryPercent === undefined ? '' : String(global.inventoryPercent),
    );
    setGlobalFixedSalaryArs(
      global?.fixedCents === null || global?.fixedCents === undefined ? '' : centsToArsInput(global.fixedCents),
    );

    const byId: Record<string, string> = {};
    for (const row of global?.categoryPercents ?? []) {
      byId[row.categoryId] = String(row.percent);
    }
    setGlobalCategoryCommissionById(byId);
  }

  function roleForInvite(workerType: InviteWorkerType): 'MANAGER' | 'EMPLOYEE' {
    return workerType === 'WORKER' ? 'EMPLOYEE' : 'MANAGER';
  }

  function toggleInviteBranch(branchId: string, checked: boolean) {
    setInviteBranchIds((current) => {
      if (checked) {
        const next = current.includes(branchId) ? current : [...current, branchId];
        if (inviteType === 'ADMIN_BRANCH') {
          return [branchId];
        }
        return next;
      }
      return current.filter((id) => id !== branchId);
    });
  }

  function setInviteModuleLevel(branchId: string, moduleId: ModulePermissionId, level: AccessLevel) {
    setInviteModuleLevelsByBranch((current) => ({
      ...current,
      [branchId]: {
        ...(current[branchId] ?? { ...DEFAULT_MODULE_LEVELS }),
        [moduleId]: level,
      },
    }));
  }

  async function markOnboardingStep(stepId: 'addWorker') {
    if (!session?.user?.id || !tenantId) return;
    try {
      await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          stepId,
          completed: true,
        }),
      });
      window.dispatchEvent(
        new CustomEvent('galto-onboarding-updated', {
          detail: { tenantId },
        }),
      );
    } catch {
      // keep invitation flow even if onboarding sync fails
    }
  }

  async function createInvite() {
    if (!session?.user?.id || !tenantId || !context) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    setInviteLink(null);

    try {
      const workerType = inviteType;
      const role = roleForInvite(workerType);

      if (!inviteBranchIds.length) {
        throw new Error('Seleccioná al menos una sucursal');
      }

      if (workerType === 'ADMIN_BRANCH' && inviteBranchIds.length !== 1) {
        throw new Error('Administrador de sucursal debe tener solo una sucursal');
      }

      const branchAccesses = inviteBranchIds
        .map((branchId) => ({
          branchId,
          permissions: moduleLevelsToPermissions(inviteModuleLevelsByBranch[branchId] ?? defaultModuleLevelsForType(inviteType)),
        }))
        .filter((entry) => entry.permissions.length > 0);

      if (!branchAccesses.length) {
        throw new Error('Definí permisos para al menos una sucursal');
      }

      const response = await fetch('/api/cuentas/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          invitedEmail: null,
          role,
          workerType,
          branchAccesses,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo crear invitación');
      }

      setInviteLink(ensurePublicUrl(String(payload?.inviteUrl ?? ''), clientOrigin));
      setStatusMessage('Invitación creada. Compartí el link para que el trabajador se una al tenant.');
      void markOnboardingStep('addWorker');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error creando invitación');
    } finally {
      setSaving(false);
    }
  }

  const externalServicesForBranch = useMemo(() => {
    if (!context || !externalBranchId) return [];
    return context.serviceCatalog.filter(
      (service) => service.branchId === externalBranchId && service.isActive,
    );
  }, [context, externalBranchId]);

  const serviceNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const service of context?.serviceCatalog ?? []) {
      map[service.id] = service.name;
    }
    return map;
  }, [context]);

  async function createExternalEmployee() {
    if (!session?.user?.id || !tenantId || !externalBranchId) return;
    setSavingExternal(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/cuentas/external-employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          branchId: externalBranchId,
          fullName: externalFullName,
          serviceIds: externalServiceIds,
          isActive: externalIsActive,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo crear la trabajadora');
      }

      setExternalFullName('');
      setExternalServiceIds([]);
      setExternalIsActive(true);
      setStatusMessage('Trabajadora creada sin cuenta.');
      void markOnboardingStep('addWorker');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error creando trabajadora');
    } finally {
      setSavingExternal(false);
    }
  }

  async function saveExternalEmployeeConfig() {
    if (!session?.user?.id || !tenantId || !selectedExternalEmployee) return;

    setSavingExternalConfig(true);
    setError(null);
    setStatusMessage(null);
    try {
      const branchId = selectedExternalEmployee.branchId;
      const schedules = (editSchedules[branchId] ?? [])
        .map((row) => ({
          dayOfWeek: Number(row.dayOfWeek),
          startTimeMin: Number(row.startTimeMin),
          endTimeMin: Number(row.endTimeMin),
        }))
        .filter((row) => row.startTimeMin < row.endTimeMin);

      const response = await fetch(`/api/cuentas/external-employees/${encodeURIComponent(selectedExternalEmployee.employeeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          fullName: editExternalFullName,
          isActive: editExternalIsActive,
          profile: {
            instagram: editInstagram,
            bio: editBio,
            personalPhone: editPhone,
          },
          schedules,
          serviceIds: editServiceIdsByBranch[branchId] ?? [],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo guardar la trabajadora');
      }

      setStatusMessage('Trabajadora actualizada.');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando trabajadora');
    } finally {
      setSavingExternalConfig(false);
    }
  }

  function setEditModuleLevel(branchId: string, moduleId: ModulePermissionId, level: AccessLevel) {
    setEditModuleLevelsByBranch((current) => ({
      ...current,
      [branchId]: {
        ...(current[branchId] ?? { ...DEFAULT_MODULE_LEVELS }),
        [moduleId]: level,
      },
    }));
  }

  function setGlobalCategoryCommission(categoryId: string, value: string) {
    setGlobalCategoryCommissionById((current) => ({ ...current, [categoryId]: value }));
  }

  function setEditCategoryCommission(categoryId: string, value: string) {
    setEditCategoryCommissionById((current) => ({ ...current, [categoryId]: value }));
  }

  async function saveGlobalCommissions() {
    if (!session?.user?.id || !tenantId || !context) return;
    if (!isPaidPlan) {
      setError('Comisiones está disponible solo en plan de pago.');
      return;
    }

    setSavingGlobalCommissions(true);
    setError(null);
    setStatusMessage(null);
    try {
      const inventoryPercent = parsePercentInput(globalInventoryCommissionPercent, 'Comisión inventario global');
      const fixedCents = parseMoneyArsToCents(globalFixedSalaryArs, 'Fijo global');
      const categoryCommissions = (context.serviceCategories ?? [])
        .map((category) => {
          const percent = parsePercentInput(globalCategoryCommissionById[category.id] ?? '', `Comisión ${category.name}`);
          if (percent === null) return null;
          return {
            categoryId: category.id,
            percent,
          };
        })
        .filter((row): row is { categoryId: string; percent: number } => Boolean(row));

      const response = await fetch('/api/cuentas/commissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          inventoryPercent,
          fixedCents,
          categoryCommissions,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo guardar comisiones globales');
      }

      setStatusMessage('Comisiones globales guardadas.');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando comisiones globales');
    } finally {
      setSavingGlobalCommissions(false);
    }
  }

  function upsertScheduleRow(branchId: string, index: number, patch: Partial<ScheduleRow>) {
    setEditSchedules((current) => {
      const rows = [...(current[branchId] ?? [])];
      rows[index] = { ...rows[index], ...patch } as ScheduleRow;
      return { ...current, [branchId]: rows };
    });
  }

  function addScheduleRow(branchId: string) {
    setEditSchedules((current) => ({
      ...current,
      [branchId]: [...(current[branchId] ?? []), { dayOfWeek: 2, startTimeMin: 9 * 60, endTimeMin: 19 * 60 }],
    }));
  }

  function removeScheduleRow(branchId: string, index: number) {
    setEditSchedules((current) => {
      const rows = [...(current[branchId] ?? [])];
      rows.splice(index, 1);
      return { ...current, [branchId]: rows };
    });
  }

  function toggleEditService(branchId: string, serviceId: string, checked: boolean) {
    setEditServiceIdsByBranch((current) => {
      const existing = current[branchId] ?? [];
      const next = checked ? (existing.includes(serviceId) ? existing : [...existing, serviceId]) : existing.filter((id) => id !== serviceId);
      return { ...current, [branchId]: next };
    });
  }

  async function saveMember() {
    if (!session?.user?.id || !tenantId || !selectedMember) {
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const branchAccesses = Object.entries(editModuleLevelsByBranch)
        .map(([branchId, moduleLevels]) => ({
          branchId,
          permissions: moduleLevelsToPermissions(moduleLevels),
        }))
        .filter((entry) => entry.permissions.length > 0);

      if (!isEditingSelf && !branchAccesses.length) {
        throw new Error('Este usuario debe tener al menos una sucursal con permisos');
      }

      const employeeSchedules = Object.entries(editSchedules).map(([branchId, schedules]) => ({
        branchId,
        schedules: schedules
          .map((row) => ({
            dayOfWeek: Number(row.dayOfWeek),
            startTimeMin: Number(row.startTimeMin),
            endTimeMin: Number(row.endTimeMin),
          }))
          .filter((row) => row.startTimeMin < row.endTimeMin),
      }));

      const servicesBranchIds = new Set<string>([
        ...Object.keys(editServiceIdsByBranch),
        ...(selectedMember.schedules ?? []).map((row) => row.branchId),
      ]);
      const employeeServices = Array.from(servicesBranchIds).map((branchId) => ({
        branchId,
        serviceIds: [...(editServiceIdsByBranch[branchId] ?? [])],
      }));

      let commissionsPayload:
        | {
            inventoryPercent: number | null;
            fixedCents: number | null;
            categoryCommissions: Array<{ categoryId: string; percent: number }>;
          }
        | undefined;
      if (canEditAdministrativeFields && isPaidPlan) {
        const inventoryPercent = parsePercentInput(editInventoryCommissionPercent, 'Comisión inventario del trabajador');
        const fixedCents = parseMoneyArsToCents(editFixedSalaryArs, 'Fijo del trabajador');
        const categoryCommissions = (context?.serviceCategories ?? [])
          .map((category) => {
            const percent = parsePercentInput(editCategoryCommissionById[category.id] ?? '', `Comisión ${category.name}`);
            if (percent === null) return null;
            return {
              categoryId: category.id,
              percent,
            };
          })
          .filter((row): row is { categoryId: string; percent: number } => Boolean(row));
        commissionsPayload = {
          inventoryPercent,
          fixedCents,
          categoryCommissions,
        };
      }

      const response = await fetch(`/api/cuentas/members/${encodeURIComponent(selectedMember.membershipId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          role: editRole,
          branchAccesses,
          profile: {
            instagram: editInstagram,
            bio: editBio,
            personalPhone: editPhone,
          },
          employeeSchedules,
          employeeServices,
          commissions: commissionsPayload,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo guardar el usuario');
      }

      setStatusMessage('Usuario actualizado correctamente.');
      await loadContext(tenantId);
      setSelectedMembershipId(selectedMember.membershipId);
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando usuario');
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember() {
    if (!session?.user?.id || !tenantId || !selectedMember || selectedMember.role === 'OWNER') {
      return;
    }

    const confirmation = window.prompt(
      `Para borrar este usuario del negocio escribí su email exactamente: ${selectedMember.email}`,
    );
    if (!confirmation) return;
    if (confirmation.trim().toLowerCase() !== selectedMember.email.trim().toLowerCase()) {
      setError('El email no coincide. No se borró el usuario.');
      return;
    }

    setDeletingMembershipId(selectedMember.membershipId);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/cuentas/members/${encodeURIComponent(selectedMember.membershipId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo borrar el usuario');
      }

      setStatusMessage('Usuario borrado del negocio.');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error borrando usuario');
    } finally {
      setDeletingMembershipId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Centro de cuentas</h1>
          <p className="text-muted-foreground">Roles, permisos por sucursal e invitaciones por link</p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 min-w-[280px]">
          <p className="text-xs text-muted-foreground">Negocio activo</p>
          <p className="text-sm font-medium">
            {selectedTenant ? `${selectedTenant.tenantName} (${selectedTenant.tenantSlug})` : 'Sin negocio'}
          </p>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {statusMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</div> : null}
      {!loading && !tenantId ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No encontramos un negocio asociado a esta cuenta. Creá tu negocio en{' '}
          <Link href="/app/planes" className="underline font-medium">
            Planes y pagos
          </Link>{' '}
          para habilitar el Centro de cuentas y generar links de invitación.
        </div>
      ) : null}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invitar trabajador
            </CardTitle>
          <CardDescription>
              El Owner genera un link por trabajador y lo comparte. El trabajador se registra desde ese link.
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tipo de trabajador</Label>
                <Select
                  value={inviteType}
                  onValueChange={(value) => {
                    const next = value as InviteWorkerType;
                    setInviteType(next);
                    const defaultLevels = defaultModuleLevelsForType(next);
                    setInviteModuleLevelsByBranch((current) => {
                      const updated: Record<string, ModuleLevelState> = {};
                      for (const branch of context?.branches ?? []) {
                        updated[branch.id] = {
                          ...defaultLevels,
                          ...(current[branch.id] ?? {}),
                        };
                      }
                      return updated;
                    });
                    if (next === 'TOTAL_POWER' || next === 'ADMIN_GENERAL') {
                      setInviteBranchIds(context?.branches.map((branch) => branch.id) ?? []);
                    }
                    if (next === 'ADMIN_BRANCH') {
                      const firstBranch = context?.branches[0]?.id;
                      setInviteBranchIds(firstBranch ? [firstBranch] : []);
                    }
                    if (next === 'WORKER') {
                      const firstBranch = context?.branches[0]?.id;
                      setInviteBranchIds(firstBranch ? [firstBranch] : []);
                    }
                  }}
                >
                  <SelectTrigger data-guide-worker-type="1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOTAL_POWER" disabled={context?.actor.role !== 'OWNER'}>
                      Total Power (sin pagos)
                    </SelectItem>
                    <SelectItem value="ADMIN_GENERAL">Administrador General</SelectItem>
                    <SelectItem value="ADMIN_BRANCH">Administrador de Sucursal</SelectItem>
                    <SelectItem value="WORKER">Trabajador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Plantilla rápida</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-guide-worker-template="1"
                    onClick={() => {
                      const defaultLevels = defaultModuleLevelsForType(inviteType);
                      setInviteModuleLevelsByBranch((current) => {
                        const updated = { ...current };
                        for (const branchId of inviteBranchIds) {
                          updated[branchId] = { ...defaultLevels };
                        }
                        return updated;
                      });
                    }}
                  >
                    Aplicar plantilla sugerida
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Sucursales habilitadas</Label>
              <div className="grid md:grid-cols-2 gap-2">
                {context?.branches.map((branch) => {
                  const checked = inviteBranchIds.includes(branch.id);
                  return (
                    <label key={branch.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(value) => toggleInviteBranch(branch.id, Boolean(value))} />
                      <span>{branch.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Permisos por módulo (No ver / Ver / Editar)</Label>
              <p className="text-xs text-muted-foreground">
                Los permisos se aplican por sucursal. Nadie puede asignar permisos que no tenga. El perfil Total Power solo lo puede dar el Owner.
              </p>
              <div className="space-y-3">
                {inviteBranchIds.map((branchId) => {
                  const branch = context?.branches.find((item) => item.id === branchId);
                  const levels = inviteModuleLevelsByBranch[branchId] ?? defaultModuleLevelsForType(inviteType);
                  return (
                    <div key={branchId} className="rounded-md border p-3 space-y-3">
                      <p className="text-sm font-semibold">{branch?.name ?? 'Sucursal'}</p>
                      <div className="space-y-2">
                        {MODULE_PERMISSION_CONFIG.map((module) => (
                          <div key={`${branchId}-${module.id}`} className="grid grid-cols-1 md:grid-cols-[1fr_170px] gap-2 items-center rounded-md border p-2">
                            <div>
                              <p className="text-sm font-medium">{module.label}</p>
                              <p className="text-xs text-muted-foreground">{module.description}</p>
                            </div>
                            <Select
                              value={module.ownerOnly ? 'NONE' : levels[module.id]}
                              onValueChange={(value) => setInviteModuleLevel(branchId, module.id, value as AccessLevel)}
                              disabled={module.ownerOnly}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">No ver</SelectItem>
                                <SelectItem value="READ">Ver</SelectItem>
                                <SelectItem value="WRITE" disabled={module.writePermissions.length === 0}>
                                  Editar
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={createInvite} disabled={saving || loading} data-guide-worker-generate-link="1">
                {saving ? 'Generando...' : 'Generar link de invitación'}
              </Button>

              {inviteLink ? (
                <Button
                  variant="outline"
                  onClick={() => void safeCopy(inviteLink, 'Link de invitación copiado.')}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar link
                </Button>
              ) : null}
            </div>

            {inviteLink ? (
              <div className="space-y-2">
                <Label>Link de invitación para compartir</Label>
                <div className="flex gap-2">
                  <Input readOnly value={ensurePublicUrl(inviteLink, clientOrigin)} />
                  <Button
                    variant="outline"
                    onClick={() => void safeCopy(inviteLink, 'Link de invitación copiado.')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {canManage ? (
          <Card data-guide-external-worker-section="1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Trabajadoras sin cuenta
              </CardTitle>
              <CardDescription>
                Creá perfiles internos sin registro. Se usan para horarios, servicios y reservas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sucursal</Label>
                  <Select value={externalBranchId} onValueChange={setExternalBranchId}>
                    <SelectTrigger data-guide-external-worker-identity="1">
                      <SelectValue placeholder="Seleccioná sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      {context?.branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input
                    data-guide-external-worker-identity="1"
                    value={externalFullName}
                    onChange={(event) => setExternalFullName(event.target.value)}
                    placeholder="Ej: María López"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Servicios que realiza</Label>
                {externalServicesForBranch.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay servicios activos en esta sucursal.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-2">
                    {externalServicesForBranch.map((service) => {
                      const checked = externalServiceIds.includes(service.id);
                      return (
                        <label key={service.id} className="flex items-center gap-2 rounded border p-2 text-xs">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const next = Boolean(value);
                              setExternalServiceIds((current) =>
                                next
                                  ? current.includes(service.id)
                                    ? current
                                    : [...current, service.id]
                                  : current.filter((id) => id !== service.id),
                              );
                            }}
                          />
                          <span>{service.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={externalIsActive} onCheckedChange={(value) => setExternalIsActive(Boolean(value))} />
                <span>Activa para asignaciones</span>
              </label>

              <Button
                onClick={createExternalEmployee}
                disabled={savingExternal || loading || !externalBranchId || !externalFullName.trim()}
                data-guide-external-worker-create="1"
              >
                {savingExternal ? 'Guardando...' : 'Agregar trabajadora'}
              </Button>

              <div className="space-y-2">
                <Label>Trabajadoras cargadas</Label>
                {(context?.externalEmployees ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no hay trabajadoras sin cuenta.</p>
                ) : (
                  <div className="space-y-2">
                    {(context?.externalEmployees ?? []).map((employee) => (
                      <div key={employee.employeeId} className="rounded-md border p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{employee.fullName}</p>
                          <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                            {employee.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{employee.branchName}</p>
                        <p className="text-xs text-muted-foreground">
                          Servicios:{' '}
                          {employee.serviceIds.length
                            ? employee.serviceIds.map((id) => serviceNameById[id] ?? 'Servicio').join(', ')
                            : 'Sin servicios asignados'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
      ) : null}

      {canManage && isPaidPlan ? (
        <Card>
          <CardHeader>
            <CardTitle>Comisiones globales del negocio</CardTitle>
            <CardDescription>
              Definí base universal para todo el equipo: inventario, fijo y porcentaje por categoría de servicio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Comisión por venta de inventario (%)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="Ej: 10"
                  value={globalInventoryCommissionPercent}
                  onChange={(event) => setGlobalInventoryCommissionPercent(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fijo del trabajador (ARS)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="Ej: 250000"
                  value={globalFixedSalaryArs}
                  onChange={(event) => setGlobalFixedSalaryArs(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Comisión por categoría de servicio (%)</Label>
              {context?.serviceCategories?.length ? (
                <div className="grid md:grid-cols-2 gap-2">
                  {context.serviceCategories.map((category) => (
                    <div key={`global-commission-${category.id}`} className="rounded border p-2 space-y-1">
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{category.branchName}</p>
                      <Input
                        inputMode="decimal"
                        placeholder="Sin valor (usa 0)"
                        value={globalCategoryCommissionById[category.id] ?? ''}
                        onChange={(event) => setGlobalCategoryCommission(category.id, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay categorías creadas todavía.</p>
              )}
            </div>

            <Button onClick={saveGlobalCommissions} disabled={savingGlobalCommissions || loading}>
              {savingGlobalCommissions ? 'Guardando...' : 'Guardar comisiones globales'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid xl:grid-cols-[380px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Equipo
            </CardTitle>
            <CardDescription>
              {loading
                ? 'Cargando...'
                : `${(context?.members.length ?? 0) + (context?.externalEmployees.length ?? 0)} perfiles`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {context?.members.map((member) => {
              const selected = selectedMembershipId === member.membershipId;
              return (
                <button
                  key={member.membershipId}
                  data-guide-worker-item="1"
                  className={`w-full text-left rounded-md border p-3 transition ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  onClick={() => {
                    setSelectedMembershipId(member.membershipId);
                    setSelectedExternalEmployeeId('');
                    hydrateEditor(member, context.branches);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{member.fullName || member.email}</p>
                    <Badge variant={member.role === 'OWNER' ? 'default' : 'secondary'}>{WORKER_TYPE_LABEL[member.workerType]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{member.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{member.branchAccesses.length} sucursales con acceso</p>
                </button>
              );
            })}

            {(context?.externalEmployees ?? []).map((employee) => {
              const selected = selectedExternalEmployeeId === employee.employeeId;
              return (
                <button
                  key={employee.employeeId}
                  data-guide-worker-item="1"
                  className={`w-full text-left rounded-md border p-3 transition ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  onClick={() => {
                    setSelectedMembershipId('');
                    setSelectedExternalEmployeeId(employee.employeeId);
                    hydrateExternalEditor(employee, context?.branches ?? []);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{employee.fullName || 'Trabajadora'}</p>
                    <Badge variant="outline">Sin cuenta</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{employee.branchName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {employee.serviceIds.length} servicios asignados
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Configuración del trabajador
            </CardTitle>
            <CardDescription>
              {selectedExternalEmployee
                ? `Editando ${selectedExternalEmployee.fullName || 'Trabajadora'} (sin cuenta)`
                : selectedMember
                  ? `Editando ${selectedMember.fullName || selectedMember.email}`
                  : 'Seleccioná un usuario'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedMember && !selectedExternalEmployee ? (
              <p className="text-sm text-muted-foreground">No hay usuario seleccionado.</p>
            ) : selectedExternalEmployee ? (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre completo</Label>
                    <Input
                      value={editExternalFullName}
                      onChange={(event) => setEditExternalFullName(event.target.value)}
                      placeholder="Nombre de la trabajadora"
                      disabled={!canManage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <label className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
                      <Checkbox checked={editExternalIsActive} onCheckedChange={(value) => setEditExternalIsActive(Boolean(value))} disabled={!canManage} />
                      <span>{editExternalIsActive ? 'Activa' : 'Inactiva'}</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input
                      value={editInstagram}
                      onChange={(event) => setEditInstagram(event.target.value)}
                      placeholder="@usuario"
                      disabled={!canManage}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Teléfono personal</Label>
                    <Input
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                      placeholder="+549..."
                      disabled={!canManage}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Descripción breve</Label>
                    <Textarea value={editBio} onChange={(event) => setEditBio(event.target.value)} rows={3} disabled={!canManage} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold" data-guide-worker-services="1">
                    Servicios que realiza
                  </h3>
                  {context?.branches
                    .filter((branch) => branch.id === selectedExternalEmployee.branchId)
                    .map((branch) => {
                      const branchServices = context.serviceCatalog.filter((service) => service.branchId === branch.id && service.isActive !== false);
                      return (
                        <div key={`external-services-${branch.id}`} className="rounded-md border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{branch.name}</p>
                            <span className="text-xs text-muted-foreground">{branchServices.length} servicios activos</span>
                          </div>

                          {branchServices.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No hay servicios activos en esta sucursal.</p>
                          ) : (
                            <div className="grid md:grid-cols-2 gap-2">
                              {branchServices.map((service) => {
                                const checked = (editServiceIdsByBranch[branch.id] ?? []).includes(service.id);
                                return (
                                  <label key={`${branch.id}-${service.id}`} className="flex items-center gap-2 rounded border p-2 text-xs">
                                    <Checkbox
                                      checked={checked}
                                      disabled={!canManage}
                                      onCheckedChange={(value) => toggleEditService(branch.id, service.id, Boolean(value))}
                                    />
                                    <span>{service.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Horarios laborales</h3>
                  {context?.branches
                    .filter((branch) => branch.id === selectedExternalEmployee.branchId)
                    .map((branch) => {
                      const rows = editSchedules[branch.id] ?? [];
                      return (
                        <div key={`external-schedule-${branch.id}`} className="rounded-md border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{branch.name}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addScheduleRow(branch.id)}
                              disabled={!canManage}
                            >
                              + Agregar bloque
                            </Button>
                          </div>

                          {rows.length === 0 ? <p className="text-xs text-muted-foreground">Sin horarios configurados.</p> : null}

                          {rows.map((row, index) => {
                            const startHour = Math.floor(row.startTimeMin / 60);
                            const startMinute = row.startTimeMin % 60;
                            const endHour = Math.floor(row.endTimeMin / 60);
                            const endMinute = row.endTimeMin % 60;
                            const startMinuteOptions = startHour === 24 ? [0] : MINUTE_OPTIONS;
                            const endMinuteOptions = endHour === 24 ? [0] : MINUTE_OPTIONS;
                            return (
                            <div key={`${branch.id}-${index}`} className="rounded-md border p-2 sm:border-0 sm:p-0">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-end">
                                <div className="space-y-1">
                                  <Label className="text-xs">Día</Label>
                                  <Select
                                    value={String(row.dayOfWeek)}
                                    disabled={!canManage}
                                    onValueChange={(value) => upsertScheduleRow(branch.id, index, { dayOfWeek: Number(value) })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DAY_LABELS.map((label, dayIndex) => (
                                        <SelectItem key={`${branch.id}-${index}-${dayIndex}`} value={String(dayIndex)}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Desde</Label>
                                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                    <select
                                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                      disabled={!canManage}
                                      value={startHour}
                                      onChange={(event) => {
                                        const nextHour = Number(event.target.value);
                                        const nextMinute = nextHour === 24 ? 0 : startMinute;
                                        upsertScheduleRow(branch.id, index, { startTimeMin: toMinutes(nextHour, nextMinute) });
                                      }}
                                    >
                                      {HOUR_OPTIONS.map((hour) => (
                                        <option key={`start-hour-${branch.id}-${index}-${hour}`} value={hour}>
                                          {String(hour).padStart(2, '0')}
                                        </option>
                                      ))}
                                    </select>
                                    <span className="text-muted-foreground text-sm">:</span>
                                    <select
                                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                      disabled={!canManage}
                                      value={startMinute}
                                      onChange={(event) =>
                                        upsertScheduleRow(branch.id, index, {
                                          startTimeMin: toMinutes(startHour, Number(event.target.value)),
                                        })
                                      }
                                    >
                                      {startMinuteOptions.map((minute) => (
                                        <option key={`start-minute-${branch.id}-${index}-${minute}`} value={minute}>
                                          {String(minute).padStart(2, '0')}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Hasta</Label>
                                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                    <select
                                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                      disabled={!canManage}
                                      value={endHour}
                                      onChange={(event) => {
                                        const nextHour = Number(event.target.value);
                                        const nextMinute = nextHour === 24 ? 0 : endMinute;
                                        upsertScheduleRow(branch.id, index, { endTimeMin: toMinutes(nextHour, nextMinute) });
                                      }}
                                    >
                                      {HOUR_OPTIONS.map((hour) => (
                                        <option key={`end-hour-${branch.id}-${index}-${hour}`} value={hour}>
                                          {String(hour).padStart(2, '0')}
                                        </option>
                                      ))}
                                    </select>
                                    <span className="text-muted-foreground text-sm">:</span>
                                    <select
                                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                      disabled={!canManage}
                                      value={endMinute}
                                      onChange={(event) =>
                                        upsertScheduleRow(branch.id, index, {
                                          endTimeMin: toMinutes(endHour, Number(event.target.value)),
                                        })
                                      }
                                    >
                                      {endMinuteOptions.map((minute) => (
                                        <option key={`end-minute-${branch.id}-${index}-${minute}`} value={minute}>
                                          {String(minute).padStart(2, '0')}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start sm:justify-center"
                                  onClick={() => removeScheduleRow(branch.id, index)}
                                  disabled={!canManage}
                                >
                                  Quitar
                                </Button>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      );
                    })}
                </div>

                {canManage ? (
                  <Button onClick={saveExternalEmployeeConfig} disabled={savingExternalConfig}>
                    <Save className="h-4 w-4 mr-2" />
                    {savingExternalConfig ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                ) : (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    Vista de solo lectura. No tenés permisos para editar esta cuenta.
                  </div>
                )}
              </>
            ) : isOwnerSelected && !canEditOwnerSelf ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                El Owner tiene permisos totales y no se edita desde este formulario.
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  {!isOwnerSelected ? (
                    <div className="space-y-2">
                      <Label>Rol técnico</Label>
                      <Select
                        value={editRole}
                        onValueChange={(value) => setEditRole(value as 'MANAGER' | 'EMPLOYEE')}
                        disabled={!canEditAdministrativeFields}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANAGER">MANAGER (Administrador)</SelectItem>
                          <SelectItem value="EMPLOYEE">EMPLOYEE (Trabajador)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input
                      value={editInstagram}
                      onChange={(event) => setEditInstagram(event.target.value)}
                      placeholder="@usuario"
                      disabled={!canEditProfile}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Teléfono personal</Label>
                    <Input
                      value={editPhone}
                      onChange={(event) => setEditPhone(event.target.value)}
                      placeholder="+549..."
                      disabled={!canEditProfile}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Descripción breve</Label>
                    <Textarea value={editBio} onChange={(event) => setEditBio(event.target.value)} rows={3} disabled={!canEditProfile} />
                  </div>
                </div>

                {!isOwnerSelected && !isEditingSelf ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-red-800">Borrar usuario del negocio</p>
                      <p className="text-xs text-red-700">
                        Se eliminan sus accesos, horarios, servicios, turnos y ventas asociadas dentro de este tenant.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void deleteMember()}
                      disabled={deletingMembershipId === selectedMember.membershipId || saving || !canEditAdministrativeFields}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deletingMembershipId === selectedMember.membershipId ? 'Borrando...' : 'Borrar usuario'}
                    </Button>
                  </div>
                ) : null}

                {!isOwnerSelected ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Permisos por módulo y sucursal</h3>
                    {context?.branches.map((branch) => (
                      <div key={branch.id} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{branch.name}</p>
                          <Badge variant="outline">/{branch.slug}</Badge>
                        </div>

                        <div className="space-y-2">
                          {MODULE_PERMISSION_CONFIG.map((module) => {
                            const level = module.ownerOnly ? 'NONE' : (editModuleLevelsByBranch[branch.id] ?? DEFAULT_MODULE_LEVELS)[module.id];
                            return (
                              <div key={`${branch.id}-${module.id}`} className="grid grid-cols-1 md:grid-cols-[1fr_170px] gap-2 items-center rounded border p-2">
                                <div>
                                  <p className="text-sm font-medium">{module.label}</p>
                                  <p className="text-xs text-muted-foreground">{module.description}</p>
                                </div>
                                <Select
                                  value={level}
                                  onValueChange={(value) => setEditModuleLevel(branch.id, module.id, value as AccessLevel)}
                                  disabled={!canEditAdministrativeFields || module.ownerOnly}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="NONE">No ver</SelectItem>
                                    <SelectItem value="READ">Ver</SelectItem>
                                    <SelectItem value="WRITE" disabled={module.writePermissions.length === 0}>
                                      Editar
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isEditingSelf ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Podés editar tu perfil, tus servicios y tus horarios. Tus permisos y rol los define un administrador.
                  </div>
                ) : null}

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold" data-guide-worker-services="1">
                    Servicios que realiza por sucursal
                  </h3>
                  {context?.branches.map((branch) => {
                    const branchServices = context.serviceCatalog.filter((service) => service.branchId === branch.id && service.isActive !== false);
                    return (
                      <div key={`services-${branch.id}`} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{branch.name}</p>
                          <span className="text-xs text-muted-foreground">{branchServices.length} servicios activos</span>
                        </div>

                        {branchServices.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No hay servicios activos en esta sucursal.</p>
                        ) : (
                          <div className="grid md:grid-cols-2 gap-2">
                            {branchServices.map((service) => {
                              const checked = (editServiceIdsByBranch[branch.id] ?? []).includes(service.id);
                              return (
                                <label key={`${branch.id}-${service.id}`} className="flex items-center gap-2 rounded border p-2 text-xs">
                                  <Checkbox
                                    checked={checked}
                                    disabled={!canEditOwnServices}
                                    onCheckedChange={(value) => toggleEditService(branch.id, service.id, Boolean(value))}
                                  />
                                  <span>{service.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Horarios laborales por sucursal</h3>
                  {context?.branches.map((branch) => {
                    const rows = editSchedules[branch.id] ?? [];
                    return (
                      <div key={`schedule-${branch.id}`} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{branch.name}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addScheduleRow(branch.id)}
                            disabled={!canEditOwnSchedules}
                          >
                            + Agregar bloque
                          </Button>
                        </div>

                        {rows.length === 0 ? <p className="text-xs text-muted-foreground">Sin horarios configurados.</p> : null}

                        {rows.map((row, index) => {
                          const startHour = Math.floor(row.startTimeMin / 60);
                          const startMinute = row.startTimeMin % 60;
                          const endHour = Math.floor(row.endTimeMin / 60);
                          const endMinute = row.endTimeMin % 60;
                          const startMinuteOptions = startHour === 24 ? [0] : MINUTE_OPTIONS;
                          const endMinuteOptions = endHour === 24 ? [0] : MINUTE_OPTIONS;
                          return (
                          <div key={`${branch.id}-${index}`} className="rounded-md border p-2 sm:border-0 sm:p-0">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-end">
                            <div className="space-y-1">
                              <Label className="text-xs">Día</Label>
                              <Select
                                value={String(row.dayOfWeek)}
                                disabled={!canEditOwnSchedules}
                                onValueChange={(value) => upsertScheduleRow(branch.id, index, { dayOfWeek: Number(value) })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DAY_LABELS.map((label, dayIndex) => (
                                    <SelectItem key={`${branch.id}-${index}-${dayIndex}`} value={String(dayIndex)}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Desde</Label>
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  disabled={!canEditOwnSchedules}
                                  value={startHour}
                                  onChange={(event) => {
                                    const nextHour = Number(event.target.value);
                                    const nextMinute = nextHour === 24 ? 0 : startMinute;
                                    upsertScheduleRow(branch.id, index, { startTimeMin: toMinutes(nextHour, nextMinute) });
                                  }}
                                >
                                  {HOUR_OPTIONS.map((hour) => (
                                    <option key={`start-hour-${branch.id}-${index}-${hour}`} value={hour}>
                                      {String(hour).padStart(2, '0')}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground text-sm">:</span>
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  disabled={!canEditOwnSchedules}
                                  value={startMinute}
                                  onChange={(event) =>
                                    upsertScheduleRow(branch.id, index, {
                                      startTimeMin: toMinutes(startHour, Number(event.target.value)),
                                    })
                                  }
                                >
                                  {startMinuteOptions.map((minute) => (
                                    <option key={`start-minute-${branch.id}-${index}-${minute}`} value={minute}>
                                      {String(minute).padStart(2, '0')}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Hasta</Label>
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  disabled={!canEditOwnSchedules}
                                  value={endHour}
                                  onChange={(event) => {
                                    const nextHour = Number(event.target.value);
                                    const nextMinute = nextHour === 24 ? 0 : endMinute;
                                    upsertScheduleRow(branch.id, index, { endTimeMin: toMinutes(nextHour, nextMinute) });
                                  }}
                                >
                                  {HOUR_OPTIONS.map((hour) => (
                                    <option key={`end-hour-${branch.id}-${index}-${hour}`} value={hour}>
                                      {String(hour).padStart(2, '0')}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground text-sm">:</span>
                                <select
                                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  disabled={!canEditOwnSchedules}
                                  value={endMinute}
                                  onChange={(event) =>
                                    upsertScheduleRow(branch.id, index, {
                                      endTimeMin: toMinutes(endHour, Number(event.target.value)),
                                    })
                                  }
                                >
                                  {endMinuteOptions.map((minute) => (
                                    <option key={`end-minute-${branch.id}-${index}-${minute}`} value={minute}>
                                      {String(minute).padStart(2, '0')}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start sm:justify-center"
                                onClick={() => removeScheduleRow(branch.id, index)}
                                disabled={!canEditOwnSchedules}
                              >
                                Quitar
                              </Button>
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    );
                  })}
                </div>

                {canEditAdministrativeFields && isPaidPlan ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Comisiones del trabajador</h3>
                    <p className="text-xs text-muted-foreground">
                      Si dejás un campo vacío, usa la configuración global del negocio.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Comisión por inventario (%)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="Ej: 12"
                          value={editInventoryCommissionPercent}
                          onChange={(event) => setEditInventoryCommissionPercent(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fijo del trabajador (ARS)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="Ej: 300000"
                          value={editFixedSalaryArs}
                          onChange={(event) => setEditFixedSalaryArs(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Comisión por categoría de servicio (%)</Label>
                      {context?.serviceCategories?.length ? (
                        <div className="grid md:grid-cols-2 gap-2">
                          {context.serviceCategories.map((category) => (
                            <div key={`member-commission-${category.id}`} className="rounded border p-2 space-y-1">
                              <p className="text-sm font-medium">{category.name}</p>
                              <p className="text-xs text-muted-foreground">{category.branchName}</p>
                              <Input
                                inputMode="decimal"
                                placeholder={`Global: ${globalCategoryCommissionById[category.id] ?? 'sin valor'}`}
                                value={editCategoryCommissionById[category.id] ?? ''}
                                onChange={(event) => setEditCategoryCommission(category.id, event.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No hay categorías creadas todavía.</p>
                      )}
                    </div>
                  </div>
                ) : null}

                {canEditProfile ? (
                  <Button onClick={saveMember} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                ) : (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    Vista de solo lectura. No tenés permisos para editar esta cuenta.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Últimas 5 invitaciones
            </CardTitle>
            <CardDescription>Se conserva historial corto para mantener ordenado el panel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(context?.invitations ?? []).map((invitation) => (
              <div key={invitation.id} className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{WORKER_TYPE_LABEL[invitation.workerType]}</Badge>
                  <Badge variant={invitation.usedAt ? 'secondary' : 'default'}>{invitation.usedAt ? 'Utilizada' : 'Pendiente'}</Badge>
                  <span className="text-muted-foreground">vence {formatDate(invitation.expiresAt)}</span>
                </div>
                <div className="pt-1 space-y-2">
                  <Input
                    readOnly
                    value={buildInvitationUrl(clientOrigin, invitation.token, tenantId)}
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const inviteUrl = buildInvitationUrl(clientOrigin, invitation.token, tenantId);
                      void safeCopy(inviteUrl, 'Link de invitación copiado.');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar link para enviar
                  </Button>
                </div>
              </div>
            ))}
            {context?.invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no creaste invitaciones.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function buildInvitationUrl(origin: string, token: string, tenantId: string) {
  return `${ensurePublicOrigin(origin)}/login?invite=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(
    tenantId,
  )}&next=${encodeURIComponent('/app/inicio')}`;
}

function ensurePublicOrigin(origin: string) {
  const envPublic = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const fallback = envPublic || (typeof window !== 'undefined' ? window.location.origin : '');
  const candidate = (origin || fallback).replace(/\/+$/, '');
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    const isIpV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0' || isIpV4) {
      return fallback || candidate;
    }
    return candidate;
  } catch {
    return fallback || candidate;
  }
}

function ensurePublicUrl(url: string, fallbackOrigin: string) {
  if (!url) return '';
  const safeOrigin = ensurePublicOrigin(fallbackOrigin);
  try {
    const parsed = new URL(url, safeOrigin || undefined);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0') {
      if (safeOrigin) {
        const fallback = new URL(safeOrigin);
        parsed.protocol = fallback.protocol;
        parsed.host = fallback.host;
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function legacyCopy(value: string) {
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

function parsePercentInput(raw: string, label: string) {
  const value = raw.trim();
  if (!value) return null;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${label}: ingresá un porcentaje entre 0 y 100`);
  }
  return Math.round(parsed * 100) / 100;
}

function parseMoneyArsToCents(raw: string, label: string) {
  const value = raw.trim();
  if (!value) return null;
  const normalized = value.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label}: ingresá un monto válido`);
  }
  return Math.round(parsed * 100);
}

function centsToArsInput(cents: number) {
  const ars = Number(cents || 0) / 100;
  return Number.isInteger(ars) ? String(ars) : ars.toFixed(2);
}
