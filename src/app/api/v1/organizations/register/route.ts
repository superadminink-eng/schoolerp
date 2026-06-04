import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminAuth } from "@/lib/firebase-admin";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { z } from "zod";

const registerSchema = z.object({
  schoolName: z.string().min(2).max(200),
  adminName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  firebaseUid: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    // Verify Firebase token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return apiError("UNAUTHORIZED", "Missing authorization token", 401);
    }

    const idToken = authHeader.slice(7);
    const adminAuth = getAdminAuth();

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return apiError("UNAUTHORIZED", "Invalid token", 401);
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid data", 422, parsed.error.errors);
    }

    const { schoolName, adminName, email, phone, firebaseUid } = parsed.data;

    // Verify the Firebase UID matches
    if (decoded.uid !== firebaseUid) {
      return apiError("FORBIDDEN", "Token mismatch", 403);
    }

    // Check if organization with this email already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { email },
    });

    if (existingOrg) {
      return apiError("CONFLICT", "An organization with this email already exists", 409);
    }

    // Generate slug from school name
    const baseSlug = schoolName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create organization, default branch, and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: schoolName,
          slug,
          email,
          phone: phone ?? null,
        },
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: `${schoolName} - Main Branch`,
          code: baseSlug.substring(0, 6).toUpperCase() + "-MAIN",
          isMain: true,
          email,
          phone: phone ?? null,
        },
      });

      const schoolAdminRole = await tx.role.findFirst({
        where: { name: "SCHOOL_ADMIN", organizationId: null }
      });

      if (!schoolAdminRole) {
        throw new Error("SCHOOL_ADMIN role not found in database. Please run seed script.");
      }

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          firebaseUid,
          email,
          name: adminName,
          phone: phone ?? null,
          roleId: schoolAdminRole.id,
        },
      });

      return { organization, branch, user };
    }, { timeout: 15000 });

    return apiSuccess(
      {
        organizationId: result.organization.id,
        slug: result.organization.slug,
        branchId: result.branch.id,
        userId: result.user.id,
      },
      undefined,
      201
    );
  } catch (error) {
    console.error("Registration error:", error);
    return apiError("INTERNAL_ERROR", "Registration failed", 500);
  }
}
