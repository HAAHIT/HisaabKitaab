import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "The dedicated measurement sync endpoint has been removed. Upload measurements through POST /api/measurements.",
    },
    { status: 410 }
  );
}
