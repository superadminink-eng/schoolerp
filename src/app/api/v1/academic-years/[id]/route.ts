import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateAcademicYearSchema } from "@/lib/validations/academic-year";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/academic-years/:id — get a single academic year
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "academic_years", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const academicYear = await prisma.academicYear.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!academicYear) return apiNotFound("Academic year");

    return apiSuccess(academicYear);
  } catch (error) {
    console.error("Get academic year error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get academic year", 500);
  }
}

/**
 * PATCH /api/v1/academic-years/:id — update an academic year
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "academic_years", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateAcademicYearSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const existing = await prisma.academicYear.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Academic year");

    const { name, startDate, endDate, isCurrent } = parsed.data;

    // Check name uniqueness if changing
    if (name && name !== existing.name) {
      const duplicate = await prisma.academicYear.findFirst({
        where: { organizationId: ctx.organizationId, name, NOT: { id } },
      });
      if (duplicate) {
        return apiError("CONFLICT", "An academic year with this name already exists", 409);
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);

    // If toggling isCurrent, use a transaction
    if (isCurrent === true) {
      const academicYear = await prisma.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { organizationId: ctx.organizationId, isCurrent: true },
          data: { isCurrent: false },
        });
        return tx.academicYear.update({
          where: { id },
          data: { ...data, isCurrent: true },
        });
      }, { timeout: 15000 });
      return apiSuccess(academicYear);
    }

    if (isCurrent !== undefined) data.isCurrent = isCurrent;

    const academicYear = await prisma.academicYear.update({
      where: { id },
      data,
    });

    return apiSuccess(academicYear);
  } catch (error) {
    console.error("Update academic year error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update academic year", 500);
  }
}

/**
 * DELETE /api/v1/academic-years/:id — delete an academic year
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "academic_years", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existing = await prisma.academicYear.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Academic year");

    // Refuse if classes exist
    const classCount = await prisma.class.count({
      where: { academicYearId: id },
    });
    if (classCount > 0) {
      return apiError(
        "CONFLICT",
        `Cannot delete: ${classCount} class${classCount > 1 ? "es" : ""} belong to this academic year`,
        409
      );
    }

    await prisma.academicYear.delete({ where: { id } });

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    console.error("Delete academic year error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete academic year", 500);
  }
}
