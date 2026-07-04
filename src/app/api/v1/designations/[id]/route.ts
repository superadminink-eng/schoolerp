import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateDesignationMasterSchema } from "@/lib/validations/designation-master";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/designations/:id — get a single designation
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "designations", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const designation = await prisma.designationMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!designation) return apiNotFound("Designation");

    return apiSuccess(designation);
  } catch (error) {
    console.error("Get designation error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get designation", 500);
  }
}

/**
 * PATCH /api/v1/designations/:id — update a designation
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "designations", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateDesignationMasterSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const existing = await prisma.designationMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Designation");

    const { code, name } = parsed.data;

    if (code && code !== existing.code) {
      const duplicateCode = await prisma.designationMaster.findFirst({
        where: {
          organizationId: ctx.organizationId,
          code,
          id: { not: id },
        },
      });
      if (duplicateCode) {
        return apiError(
          "CONFLICT",
          `A designation with code "${code}" already exists`,
          409
        );
      }
    }

    if (name && name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
      const duplicateName = await prisma.designationMaster.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: name.trim(),
          id: { not: id },
        },
      });
      if (duplicateName) {
        return apiError(
          "CONFLICT",
          `A designation with the name "${name}" already exists`,
          409
        );
      }
    }

    const updated = await prisma.designationMaster.update({
      where: { id },
      data: parsed.data,
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Update designation error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update designation", 500);
  }
}

/**
 * DELETE /api/v1/designations/:id — soft-delete or hard-delete
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "designations", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existing = await prisma.designationMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Designation");

    const refCount = await prisma.staffDesignation.count({
      where: { designationId: id },
    });

    if (refCount > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: "HAS_DEPENDENCIES",
          message: `Cannot delete because ${refCount} staff member(s) hold this designation. Please 'Deactivate' it from Edit menu instead.`,
          meta: { refCount }
        }
      }, { status: 409 });
    }

    await prisma.designationMaster.delete({ where: { id } });
    return apiSuccess({ id, deleted: true });
  } catch (error) {
    console.error("Delete designation error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete designation", 500);
  }
}
