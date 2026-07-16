import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateNoticeSchema } from "@/lib/validations/notice";
import { logAction } from "@/lib/audit";

type RouteContext = any;

/**
 * GET /api/v1/notices/:id — retrieve details for a single notice
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "notices", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const notice = await prisma.notice.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!notice) return apiNotFound("Notice");

    // Enforce branch scope isolation for non-global roles
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      if (notice.branchId !== ctx.branchId) {
        return apiError("FORBIDDEN", "Access to this notice is forbidden", 403);
      }
    }

    let parsedRoles: string[] = [];
    try {
      parsedRoles = JSON.parse(notice.targetRoles);
    } catch {
      parsedRoles = [];
    }

    return apiSuccess({
      ...notice,
      targetRoles: parsedRoles,
    });
  } catch (error) {
    console.error("Get notice error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get notice", 500);
  }
}

/**
 * PATCH /api/v1/notices/:id — update a notice
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "notices", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateNoticeSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const data = parsed.data;

  try {
    const existing = await prisma.notice.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Notice");

    // Enforce branch scope isolation for non-global roles
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      if (existing.branchId !== ctx.branchId) {
        return apiError("FORBIDDEN", "Cannot modify notice from another branch", 403);
      }
      if (data.branchId !== undefined && data.branchId !== ctx.branchId) {
        return apiError("FORBIDDEN", "Cannot move notice to another branch", 403);
      }
    }

    // Prepare update data
    const updateData: Record<string, any> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.targetRoles !== undefined) {
      updateData.targetRoles = JSON.stringify(data.targetRoles);
    }
    if (data.branchId !== undefined) updateData.branchId = data.branchId || null;
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }

    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
      if (data.isPublished) {
        const isFuture = existing.publishedAt && new Date(existing.publishedAt) > new Date();
        updateData.publishedAt = existing.isPublished && existing.publishedAt && !isFuture ? existing.publishedAt : new Date();
      } else {
        if (data.publishedAt) {
          updateData.publishedAt = new Date(data.publishedAt);
          updateData.isPublished = true;
        } else {
          updateData.publishedAt = null;
        }
      }
    } else if (data.publishedAt !== undefined) {
      updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
      updateData.isPublished = !!data.publishedAt;
    }

    const updated = await prisma.notice.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: updated.branchId,
      userId: ctx.userId,
      action: "UPDATE",
      module: "notices",
      entityId: updated.id,
      details: { title: updated.title, isPublished: updated.isPublished },
    });

    let parsedRoles: string[] = [];
    try {
      parsedRoles = JSON.parse(updated.targetRoles);
    } catch {
      parsedRoles = [];
    }

    return apiSuccess({
      ...updated,
      targetRoles: parsedRoles,
    });
  } catch (error) {
    console.error("Update notice error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update notice", 500);
  }
}

/**
 * DELETE /api/v1/notices/:id — delete a notice
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "notices", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existing = await prisma.notice.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Notice");

    // Enforce branch scope isolation for non-global roles
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      if (existing.branchId !== ctx.branchId) {
        return apiError("FORBIDDEN", "Cannot delete notice from another branch", 403);
      }
    }

    await prisma.notice.delete({
      where: { id },
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: existing.branchId,
      userId: ctx.userId,
      action: "DELETE",
      module: "notices",
      entityId: existing.id,
      details: { title: existing.title },
    });

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    console.error("Delete notice error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete notice", 500);
  }
}
