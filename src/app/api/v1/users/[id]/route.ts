import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminAuth } from "@/lib/firebase-admin";
import { apiSuccess, apiError, apiValidationError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext, hasPermission, getUserPermissions } from "@/lib/rbac";
import { updateUserSchema } from "@/lib/validations/user";
import { logAction } from "@/lib/audit";
import { rbacCache } from "@/lib/rbac-cache";

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

  const canViewAllBranches = await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "branches", "view_all");
  if (!canViewAllBranches && ctx.branchId) {
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
        permissions: { select: { permissionId: true, granted: true } },
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


    // Role Hierarchy Guard
    const getRoleWeight = (name: string) => {
      switch (name) {
        case "SUPER_ADMIN": return 100;
        case "SCHOOL_ADMIN": return 90;
        case "BRANCH_ADMIN": return 80;
        default: return 10;
      }
    };
    const callerWeight = getRoleWeight(ctx.roleName);
    const targetWeight = getRoleWeight(existing.role.name);
    if (ctx.roleName !== "SUPER_ADMIN" && callerWeight <= targetWeight) {
      return apiError("FORBIDDEN", "Insufficient privileges to modify a user with an equal or higher role level", 403);
    }

    // Restrict branch-scoped roles from modifying users in another branch
    const canManageAllBranches = await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "branches", "manage");
    if (!canManageAllBranches && ctx.branchId && existing.branchId !== ctx.branchId) {
      return apiError("FORBIDDEN", "Cannot modify users in another branch", 403);
    }

    const { name, phone, roleId, branchId, isActive, password, customPermissions } = parsed.data;

    // Self-Lockout Prevention (Anti-Suicide Rule)
    if (id === ctx.userId && isActive === false) {
      return apiError("FORBIDDEN", "Self-Lockout Prevention: You cannot deactivate your own account.", 403);
    }
    if (id === ctx.userId && roleId && roleId !== existing.roleId) {
      return apiError("FORBIDDEN", "Self-Lockout Prevention: You cannot change your own role.", 403);
    }

    // Last Man Standing Failsafe (Protects SCHOOL_ADMIN locally)
    if (existing.role.name === "SCHOOL_ADMIN" && (isActive === false || (roleId && roleId !== existing.roleId))) {
      const activeSchoolAdminsCount = await prisma.user.count({
        where: { role: { name: "SCHOOL_ADMIN" }, isActive: true, organizationId: ctx.organizationId }
      });
      if (activeSchoolAdminsCount <= 1) {
        return apiError("FORBIDDEN", "The Last Man Standing Rule: Cannot deactivate or demote the only remaining active School Admin.", 403);
      }
    }

    // Last Man Standing Failsafe (Protects SUPER_ADMIN globally)
    if (existing.role.name === "SUPER_ADMIN" && (isActive === false || (roleId && roleId !== existing.roleId))) {
      const activeSuperAdminsCount = await prisma.user.count({
        where: { role: { name: "SUPER_ADMIN" }, isActive: true }
      });
      if (activeSuperAdminsCount <= 1) {
        return apiError("FORBIDDEN", "The Last Man Standing Rule: Cannot deactivate or demote the only remaining active Super Admin globally.", 403);
      }
    }

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

    // Cannot promote to SUPER_ADMIN unless caller is SUPER_ADMIN (Handover Rule)
    if (targetRole.name === "SUPER_ADMIN" && existing.role.name !== "SUPER_ADMIN" && ctx.roleName !== "SUPER_ADMIN") {
      return apiError("FORBIDDEN", "Only Super Admins can assign the Super Admin role", 403);
    }

    // Restrict promoting to SCHOOL_ADMIN role to only SUPER_ADMIN or SCHOOL_ADMIN callers
    if (targetRole.name === "SCHOOL_ADMIN") {
      if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN") {
        return apiError("FORBIDDEN", "Insufficient privileges to assign the SCHOOL_ADMIN role", 403);
      }
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
    
    if (customPermissions) {
      // Security Gate: Ensure caller has the permissions they are trying to grant or revoke
      if (ctx.roleName !== "SUPER_ADMIN" && customPermissions.length > 0) {
        const callerPerms = await getUserPermissions(ctx.userId, ctx.roleId, ctx.roleName);
        const permissionsToVerify = await prisma.permission.findMany({
          where: { id: { in: customPermissions.map(p => p.permissionId) } }
        });
        for (const perm of permissionsToVerify) {
          const permKey = `${perm.module}:${perm.action}`;
          if (!callerPerms.has(permKey)) {
            return apiError("FORBIDDEN", `Cannot grant or revoke permission "${permKey}" that you do not possess`, 403);
          }
        }
      }

      // Delete existing overrides for this user
      await prisma.userPermission.deleteMany({
        where: { userId: id }
      });

      // Insert new overrides if any
      if (customPermissions.length > 0) {
        await prisma.userPermission.createMany({
          data: customPermissions.map((p) => ({
            userId: id,
            permissionId: p.permissionId,
            granted: p.granted
          }))
        });
      }
    }

    // Invalidate the cache instantly if role or permissions changed
    if (customPermissions || roleId !== undefined) {
      rbacCache.clearUser(id);
    }

    // Build update data
    const data: Record<string, any> = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone || null;
    if (roleId !== undefined) data.roleId = roleId;
    if (branchId !== undefined) data.branchId = branchId;
    if (isActive !== undefined) data.isActive = isActive;

    if (password) {
      data.forcePasswordChange = true;
      data.tokenVersion = { increment: 1 };
    }

    // Sync Firebase display name if name changed
    if (name !== undefined) {
      try {
        await getAdminAuth().updateUser(existing.firebaseUid, { displayName: name });
      } catch (err) {
        console.error("Firebase updateUser displayName error:", err);
      }
    }

    // Sync Firebase password if password provided
    if (password) {
      try {
        await getAdminAuth().updateUser(existing.firebaseUid, { password });
      } catch (err) {
        console.error("Firebase updateUser password error:", err);
        return apiError("INTERNAL_ERROR", "Failed to update credentials in authentication server", 500);
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

    // Phase 6: Sync Data Drift
    if (name !== undefined || phone !== undefined || isActive !== undefined) {
      const syncData: any = {};
      if (name !== undefined) syncData.name = name;
      if (phone !== undefined) syncData.phone = phone || null;
      if (isActive !== undefined && !isActive) syncData.status = "TERMINATED"; // Optional: sync deactivation to termination

      if (Object.keys(syncData).length > 0) {
        await prisma.staff.updateMany({
          where: { userId: user.id },
          data: syncData,
        });
      }
    }

    await logAction({
      organizationId: ctx.organizationId,
      branchId: user.branch?.id || null,
      userId: ctx.userId,
      action: "UPDATE",
      module: "USERS",
      entityId: user.id,
      details: password ? [...Object.keys(data), "password_reset"] : Object.keys(data),
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

    // Cannot delete yourself (Anti-Suicide)
    if (existing.id === ctx.userId) {
      return apiError("FORBIDDEN", "Cannot deactivate your own account", 403);
    }

    // Last Man Standing Failsafe
    if (existing.role.name === "SUPER_ADMIN") {
      const activeSuperAdminsCount = await prisma.user.count({
        where: { role: { name: "SUPER_ADMIN" }, isActive: true, organizationId: ctx.organizationId }
      });
      if (activeSuperAdminsCount <= 1) {
        return apiError("FORBIDDEN", "The Last Man Standing Rule: Cannot deactivate the only remaining active Super Admin.", 403);
      }
    }

    // Restrict branch-scoped roles from deactivating users in another branch
    const canManageAllBranches = await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "branches", "manage");
    if (!canManageAllBranches && ctx.branchId && existing.branchId !== ctx.branchId) {
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
