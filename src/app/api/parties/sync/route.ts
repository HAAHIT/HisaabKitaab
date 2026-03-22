import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Offline party sync has been removed. Use /api/parties and /api/parties/[id] for party writes.",
    },
    { status: 410 }
  );
}
