import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminAuth } from "@/lib/firebase-admin";
import { apiSuccess, apiError, apiValidationError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateUserSchema } from "@/lib/validations/user";
import { logAction } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/users/:id — get a single user
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "users", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  const where: Record<string, unknown> = {
    id,
    organizationId: ctx.organizationId,
  };

  if (ctx.role === "BRANCH_ADMIN" && ctx.branchId) {
    where.branchId = ctx.branchId;
  }

  try {
    const user = await prisma.user.findFirst({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: { select: { id: true, name: true } },
        isActive: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
      },
    });

    if (!user) return apiNotFound("User");

    return apiSuccess(user);
  } catch (error) {
    console.error("Get user error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get user", 500);
  }
}

/**
 * PATCH /api/v1/users/:id — update a user
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "users", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    // Find the user in this organization
    const existing = await prisma.user.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { role: true },
    });

    if (!existing) return apiNotFound("User");

    // Cannot edit SUPER_ADMIN users
    if (existing.role.name === "SUPER_ADMIN") {
      return apiError("FORBIDDEN", "Cannot modify a SUPER_ADMIN user", 403);
    }

    // BRANCH_ADMIN can only edit users in their branch
    if (ctx.role === "BRANCH_ADMIN" && ctx.branchId && existing.branchId !== ctx.branchId) {
      return apiError("FORBIDDEN", "Cannot modify users in another branch", 403);
    }

    const { name, phone, roleId, branchId, isActive } = parsed.data;

    let targetRole = existing.role;
    if (roleId) {
      const foundRole = await prisma.role.findFirst({
        where: { 
          id: roleId,
          OR: [{ organizationId: ctx.organizationId }, { organizationId: null }]
        },
      });
      if (!foundRole) return apiError("NOT_FOUND", "Role not found", 404);
      targetRole = foundRole;
    }

    // Cannot promote to SUPER_ADMIN (defensive check)
    if (targetRole.name === "SUPER_ADMIN") {
      return apiError("FORBIDDEN", "Cannot assign SUPER_ADMIN role", 403);
    }

    // Validate branch if changing
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, organizationId: ctx.organizationId, isActive: true },
      });
      if (!branch) {
        return apiError("NOT_FOUND", "Branch not found", 404);
      }
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone || null;
    if (roleId !== undefined) data.roleId = roleId;
    if (branchId !== undefined) data.branchId = branchId;
    if (isActive !== undefined) data.isActive = isActive;

    // Sync Firebase display name if name changed
    if (name !== undefined) {
      try {
        await getAdminAuth().updateUser(existing.firebaseUid, { displayName: name });
      } catch (err) {
        console.error("Firebase updateUser displayName error:", err);
      }
    }

    // Sync Firebase disabled state if isActive changed
    if (isActive !== undefined) {
      try {
        await getAdminAuth().updateUser(existing.firebaseUid, { disabled: !isActive });
      } catch (err) {
        console.error("Firebase updateUser disabled error:", err);
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: { select: { id: true, name: true } },
        isActive: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
      },
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: user.branchId,
      userId: ctx.userId,
      action: "UPDATE",
      module: "USERS",
      entityId: user.id,
      details: Object.keys(data),
    });

    return apiSuccess(user);
  } catch (error) {
    console.error("Update user error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update user", 500);
  }
}

/**
 * DELETE /api/v1/users/:id — soft-delete (deactivate) a user
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "users", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existing = await prisma.user.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { role: true }
    });

    if (!existing) return apiNotFound("User");

    // Cannot delete SUPER_ADMIN
    if (existing.role.name === "SUPER_ADMIN") {
      return apiError("FORBIDDEN", "Cannot deactivate a SUPER_ADMIN user", 403);
    }

    // Cannot delete yourself
    if (existing.id === ctx.userId) {
      return apiError("FORBIDDEN", "Cannot deactivate your own account", 403);
    }

    // BRANCH_ADMIN can only delete users in their branch
    if (ctx.role === "BRANCH_ADMIN" && ctx.branchId && existing.branchId !== ctx.branchId) {
      return apiError("FORBIDDEN", "Cannot deactivate users in another branch", 403);
    }

    // Soft-delete: set isActive to false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Disable Firebase account
    try {
      await getAdminAuth().updateUser(existing.firebaseUid, { disabled: true });
    } catch (err) {
      console.error("Firebase disable user error:", err);
    }

    await logAction({
      organizationId: ctx.organizationId,
      branchId: existing.branchId,
      userId: ctx.userId,
      action: "DELETE",
      module: "USERS",
      entityId: existing.id,
      details: { reason: "Deactivated via API" },
    });

    return apiSuccess({ id, deactivated: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return apiError("INTERNAL_ERROR", "Failed to deactivate user", 500);
  }
}
