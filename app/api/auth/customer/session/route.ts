import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json(
    { message: 'Este endpoint está deprecado. Usá /api/auth/customer/request-otp y /api/auth/customer/verify-otp' },
    { status: 410 },
  );
}
