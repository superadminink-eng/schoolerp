import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateDepartmentMasterSchema } from "@/lib/validations/department-master";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/departments/:id — get a single department
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "departments", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const department = await prisma.departmentMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!department) return apiNotFound("Department");

    return apiSuccess(department);
  } catch (error) {
    console.error("Get department error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get department", 500);
  }
}

/**
 * PATCH /api/v1/departments/:id — update a department
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "departments", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateDepartmentMasterSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const existing = await prisma.departmentMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Department");

    const { code, name } = parsed.data;

    if (code && code !== existing.code) {
      const duplicateCode = await prisma.departmentMaster.findFirst({
        where: {
          organizationId: ctx.organizationId,
          code,
          id: { not: id },
        },
      });
      if (duplicateCode) {
        return apiError(
          "CONFLICT",
          `A department with code "${code}" already exists`,
          409
        );
      }
    }

    if (name && name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
      const duplicateName = await prisma.departmentMaster.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: name.trim(),
          id: { not: id },
        },
      });
      if (duplicateName) {
        return apiError(
          "CONFLICT",
          `A department with the name "${name}" already exists`,
          409
        );
      }
    }

    const updated = await prisma.departmentMaster.update({
      where: { id },
      data: parsed.data,
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Update department error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update department", 500);
  }
}

/**
 * DELETE /api/v1/departments/:id — soft-delete or hard-delete
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "departments", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existing = await prisma.departmentMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Department");

    const refCount = await prisma.staff.count({
      where: { departmentId: id },
    });

    if (refCount > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: "HAS_DEPENDENCIES",
          message: `Cannot delete because ${refCount} staff member(s) belong to this department. Please 'Deactivate' it from Edit menu instead.`,
          meta: { refCount }
        }
      }, { status: 409 });
    }

    await prisma.departmentMaster.delete({ where: { id } });
    return apiSuccess({ id, deleted: true });
  } catch (error) {
    console.error("Delete department error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete department", 500);
  }
}
