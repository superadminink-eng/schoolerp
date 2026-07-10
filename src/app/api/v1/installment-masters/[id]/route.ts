import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateInstallmentMasterSchema } from "@/lib/validations/installment-master";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/installment-masters/[id] — update an installment master
 */
export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const denied = await checkApiPermission(req, "fees", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateInstallmentMasterSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, code, description, isActive } = parsed.data;

  try {
    const existing = await prisma.installmentMaster.findFirst({
      where: {
        id: params.id,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Installment master not found", 404);
    }

    // Check unique constraints if name or code changed
    if ((name && name !== existing.name) || (code && code !== existing.code)) {
      const duplicate = await prisma.installmentMaster.findFirst({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          id: { not: params.id },
          OR: [
            ...(code ? [{ code }] : []),
            ...(name ? [{ name: name.trim() }] : []),
          ],
        },
      });

      if (duplicate) {
        if (duplicate.code === code) {
          return apiError("CONFLICT", `An installment master with code "${code}" already exists`, 409);
        } else {
          return apiError("CONFLICT", `An installment master with the name "${name}" already exists`, 409);
        }
      }
    }

    const updated = await prisma.installmentMaster.update({
      where: { id: params.id },
      data: {
        name: name ? name.trim() : undefined,
        code,
        description,
        isActive,
      },
    });

    return apiSuccess(updated);
  } catch (error: any) {
    console.error("Update installment master error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update installment master", 500);
  }
}

/**
 * DELETE /api/v1/installment-masters/[id] — soft delete an installment master
 */
export async function DELETE(
  req: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const denied = await checkApiPermission(req, "fees", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  try {
    const existing = await prisma.installmentMaster.findFirst({
      where: {
        id: params.id,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Installment master not found", 404);
    }

    // Soft delete to preserve historical reporting
    await prisma.installmentMaster.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return apiSuccess({ message: "Installment master deleted successfully" });
  } catch (error) {
    console.error("Delete installment master error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete installment master", 500);
  }
}
