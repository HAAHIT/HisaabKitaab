import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Offline bill sync has been removed. Create and update bills through /api/bills and /api/bills/[id].",
    },
    { status: 410 }
  );
}
