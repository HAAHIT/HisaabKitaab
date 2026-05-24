import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import crypto from "crypto";

function normalizeOptionalString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  // 5 registrations per minute per IP — bcrypt is a CPU amplifier, so an
  // unthrottled endpoint is a trivial DoS vector even before considering spam.
  const rateLimitResponse = await checkRateLimit(request, "auth.register", 5);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = normalizeOptionalString(body.email);
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";

    if (!name || (!email && !phone) || !password || !companyName) {
      return NextResponse.json(
        { error: "Name, email or phone, password, and company name are required" },
        { status: 400 }
      );
    }

    if (password.length < 12) {
      return NextResponse.json(
        { error: "Password must be at least 12 characters" },
        { status: 400 }
      );
    }

    // Global uniqueness check for email and phone across all tenants. Use a
    // generic error so the response does not confirm whether a given email or
    // phone is registered (account enumeration mitigation).
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "This email is already registered. Try logging in, or use a different email address." },
          { status: 409 }
        );
      }
    }

    if (phone) {
      const existingUser = await prisma.user.findFirst({
        where: { phone },
        select: { id: true },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "This phone number is already registered. Try logging in, or use a different number." },
          { status: 409 }
        );
      }
    }

    // Generate slug from company name. Append a short random suffix on
    // collision rather than a predictable counter — sequential -1, -2, -3
    // suffixes leak tenant existence and would let an attacker enumerate
    // every company on the platform by trying slugs.
    const baseSlug =
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "company";

    let slug = baseSlug;
    for (let attempt = 0; attempt < 8; attempt++) {
      const existingTenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existingTenant) break;
      const suffix = crypto.randomBytes(3).toString("hex");
      slug = `${baseSlug}-${suffix}`;
      if (attempt === 7) {
        // Eight collisions on a 24-bit suffix is astronomically unlikely
        // and almost certainly indicates abuse or a stuck cuid generator.
        logError("auth.register.slug_exhausted", {
          requestId: getRequestId(request),
          baseSlug,
        });
        return NextResponse.json(
          { error: "Could not create account, please try a different company name" },
          { status: 409 }
        );
      }
    }

    const hashedPassword = await hashPassword(password);

    // Create Tenant and Admin user inside transaction
    type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
    const { tenant, user } = await prisma.$transaction(async (tx: PrismaTx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug,
          settings: {
            companyName,
            onboardingComplete: false,
          },
        },
      });

      const newUser = await tx.user.create({
        data: {
          tenantId: newTenant.id,
          name,
          email,
          phone: phone || null,
          password: hashedPassword,
          role: "ADMIN",
          isActive: true,
        },
      });

      return { tenant: newTenant, user: newUser };
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    logError("auth.register.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
