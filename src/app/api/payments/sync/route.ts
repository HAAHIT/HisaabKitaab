import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Offline payment sync has been removed. Record and update payments through /api/payments.",
    },
    { status: 410 }
  );
}
