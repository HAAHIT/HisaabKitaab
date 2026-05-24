import { deleteSession } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/cookie";
import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/public-url";

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(publicUrl(request, "/login"));
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
