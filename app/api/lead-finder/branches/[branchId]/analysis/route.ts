import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getLeadFinderAnalysis } from '@/lib/server/lead-finder-data';

type Params = {
  params: Promise<{
    branchId: string;
  }>;
};

export async function GET(request: NextRequest, context: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await context.params;
  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';

  if (!userId || !tenantId || !branchId) {
    return NextResponse.json({ message: 'userId, tenantId y branchId son obligatorios' }, { status: 400 });
  }

  try {
    const analysis = await getLeadFinderAnalysis({
      userId,
      tenantId,
      branchId,
      forceRefresh,
    });
    return NextResponse.json({ analysis });
  } catch (error: any) {
    return NextResponse.json(
      { message: String(error?.message ?? 'No se pudo cargar Lead Finder') },
      { status: 400 },
    );
  }
}

