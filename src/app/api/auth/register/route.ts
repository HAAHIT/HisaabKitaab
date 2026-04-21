import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";

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

    // Global uniqueness check for email and phone across all tenants
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "Email is already registered" },
          { status: 409 }
        );
      }
    }

    if (phone) {
      const existingUser = await prisma.user.findFirst({
        where: { phone },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "Phone number is already registered" },
          { status: 409 }
        );
      }
    }

    // Generate slug from company name
    const baseSlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    
    // Check if slug exists in loop to guarantee unique
    let slug = baseSlug || "company";
    let attempts = 0;
    while (true) {
      const existingTenant = await prisma.tenant.findUnique({
        where: { slug },
      });
      if (!existingTenant) break;
      attempts++;
      slug = `${baseSlug}-${attempts}`;
    }

    const hashedPassword = await hashPassword(password);

    // Create Tenant and Admin user inside transaction
    const { tenant, user } = await prisma.$transaction(async (tx: any) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug,
          settings: {
             companyName,
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

    // Sign the user in automatically
    await createSession({
      userId: user.id,
      tenantId: tenant.id,
      name: user.name,
      role: user.role,
      email: user.email || undefined,
      phone: user.phone || undefined,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("API error in register POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
