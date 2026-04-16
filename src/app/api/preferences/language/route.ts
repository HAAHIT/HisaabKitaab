import { NextRequest, NextResponse } from "next/server";
import {
  LANGUAGE_COOKIE_NAME,
  normalizeLanguage,
} from "@/lib/i18n/translations";

function getSafeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/login";
  }

  return value;
}

export function GET(request: NextRequest) {
  const language = normalizeLanguage(request.nextUrl.searchParams.get("lang"));
  const returnTo = getSafeReturnPath(
    request.nextUrl.searchParams.get("returnTo")
  );
  const redirectUrl = new URL(returnTo, request.url);
  const response = NextResponse.redirect(redirectUrl, { status: 303 });

  response.cookies.set(LANGUAGE_COOKIE_NAME, language, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });

  return response;
}
