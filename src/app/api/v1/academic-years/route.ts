import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createAcademicYearSchema } from "@/lib/validations/academic-year";

/**
 * GET /api/v1/academic-years — list academic years for the organization
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "academic_years", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  try {
    const academicYears = await prisma.academicYear.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { startDate: "desc" },
    });

    return apiSuccess(academicYears);
  } catch (error) {
    console.error("List academic years error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list academic years", 500);
  }
}

/**
 * POST /api/v1/academic-years — create a new academic year
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "academic_years", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createAcademicYearSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, startDate, endDate, isCurrent } = parsed.data;

  try {
    // Check name uniqueness within organization
    const existing = await prisma.academicYear.findFirst({
      where: { organizationId: ctx.organizationId, name },
    });
    if (existing) {
      return apiError("CONFLICT", "An academic year with this name already exists", 409);
    }

    // If setting as current, unset other current years in a transaction
    if (isCurrent) {
      const academicYear = await prisma.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { organizationId: ctx.organizationId, isCurrent: true },
          data: { isCurrent: false },
        });
        return tx.academicYear.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isCurrent: true,
          },
        });
      }, { timeout: 15000 });
      return apiSuccess(academicYear, undefined, 201);
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: false,
      },
    });

    return apiSuccess(academicYear, undefined, 201);
  } catch (error) {
    console.error("Create academic year error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create academic year", 500);
  }
}
