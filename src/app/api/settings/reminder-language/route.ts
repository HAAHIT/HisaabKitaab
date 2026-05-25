import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

const ALLOWED_LANGUAGES = ["hinglish", "hindi", "english"] as const;
type ReminderLanguage = typeof ALLOWED_LANGUAGES[number];

/**
 * PATCH /api/settings/reminder-language
 *
 * Updates the tenant's preferred reminder language for WhatsApp messages.
 * Access: ADMIN only.
 */
export async function PATCH(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const lang = body?.reminderLanguage as string | undefined;

    if (!lang || !(ALLOWED_LANGUAGES as readonly string[]).includes(lang)) {
      return NextResponse.json(
        { error: `reminderLanguage must be one of: ${ALLOWED_LANGUAGES.join(", ")}` },
        { status: 400 }
      );
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { reminderLanguage: lang as ReminderLanguage },
    });

    return NextResponse.json({ reminderLanguage: lang });
  } catch (error) {
    logError("settings.reminder-language.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
