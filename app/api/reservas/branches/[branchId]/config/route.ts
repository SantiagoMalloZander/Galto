import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import {
  assertTenantAccess,
  getBranchFullConfig,
  getTenantBookingDomain,
  updateBranchConfig,
} from '@/lib/server/reservas-data';

interface Params {
  params: Promise<{ branchId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const userId = request.nextUrl.searchParams.get('userId');
  const tenantId = request.nextUrl.searchParams.get('tenantId');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const access = await assertTenantAccess(userId, tenantId);
  if (!access) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }

  const config = await getBranchFullConfig(tenantId, branchId);
  if (!config) {
    return NextResponse.json({ message: 'Sucursal no encontrada' }, { status: 404 });
  }

  const domain = await getTenantBookingDomain(tenantId);
  return NextResponse.json({ config, domain });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const branch = body?.branch;
  const profile = body?.profile;
  const tenantVisual = body?.tenantVisual;
  const schedules = Array.isArray(body?.schedules) ? body.schedules : [];

  if (!userId || !tenantId || !branch) {
    return NextResponse.json({ message: 'userId, tenantId y branch son obligatorios' }, { status: 400 });
  }

  const access = await assertTenantAccess(userId, tenantId);
  if (!access) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }

  await updateBranchConfig({
    tenantId,
    branchId,
    branch: {
      name: String(branch.name ?? ''),
      timeZone: String(branch.timeZone ?? 'America/Argentina/Buenos_Aires'),
      allowChooseEmployee: Boolean(branch.allowChooseEmployee),
      assignmentStrategy: String(branch.assignmentStrategy ?? 'ROTATIVE') as any,
    },
    profile: {
      address: profile?.address,
      phone: profile?.phone,
      showServicePrices: profile?.showServicePrices !== false,
      policyText: profile?.policyText,
      cancellationEnabled: Boolean(profile?.cancellationEnabled),
      depositType: String(profile?.depositType ?? 'NONE') as any,
      depositAmount: Number(profile?.depositAmount ?? 0),
      publicNote: profile?.publicNote,
      profilePhotoUrl: profile?.profilePhotoUrl,
      bannerPhotoUrl: profile?.bannerPhotoUrl,
      carouselPhotoUrls: Array.isArray(profile?.carouselPhotoUrls) ? profile.carouselPhotoUrls : [],
      useCustomWhatsappApi: Boolean(profile?.useCustomWhatsappApi),
      whatsappMetaAccessToken: profile?.whatsappMetaAccessToken,
      whatsappMetaPhoneNumberId: profile?.whatsappMetaPhoneNumberId,
      whatsappMetaGraphVersion: profile?.whatsappMetaGraphVersion,
      whatsappMetaOtpTemplateName: profile?.whatsappMetaOtpTemplateName,
      whatsappMetaOtpTemplateLang: profile?.whatsappMetaOtpTemplateLang,
      mercadoPagoPublicKey: profile?.mercadoPagoPublicKey,
      mercadoPagoAccessToken: profile?.mercadoPagoAccessToken,
      chatgptApiKey: profile?.chatgptApiKey,
    },
    tenantVisual: {
      logoPhotoUrl: tenantVisual?.logoPhotoUrl,
      bannerPhotoUrl: tenantVisual?.bannerPhotoUrl,
    },
    schedules: schedules.map((row: any) => ({
      dayOfWeek: Number(row.dayOfWeek),
      startTimeMin: Number(row.startTimeMin),
      endTimeMin: Number(row.endTimeMin),
    })),
  });

  const next = await getBranchFullConfig(tenantId, branchId);
  return NextResponse.json({ config: next });
}
