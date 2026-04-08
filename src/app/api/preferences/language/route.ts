import { NextRequest, NextResponse } from "next/server";
import {
  LANGUAGE_COOKIE_NAME,
  normalizeLanguage,
} from "@/lib/i18n/translations";

/**
 * Ensures a candidate return path is a safe, single-root-relative path.
 *
 * @param value - Candidate return path; may be `null` or any string.
 * @returns A path that starts with a single leading `'/'`, or `'/login'` if the input is `null`, empty, does not start with `'/'`, or starts with `'//'`.
 */
function getSafeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/login";
  }

  return value;
}

/**
 * Sets the user's preferred language in a cookie and redirects the client to a sanitized return path.
 *
 * Reads `lang` and `returnTo` from the request's query parameters, normalizes the language, stores it in a cookie named by `LANGUAGE_COOKIE_NAME` (path `/`, maxAge 31536000, SameSite `lax`), and issues a 303 redirect to a safe path derived from `returnTo`.
 *
 * @param request - Incoming Next.js request containing `lang` and optional `returnTo` query parameters
 * @returns A 303 redirect response to the sanitized return path with the language cookie set
 */
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
