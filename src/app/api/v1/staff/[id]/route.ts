import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext, getUserPermissions } from "@/lib/rbac";
import { updateStaffSchema } from "@/lib/validations/staff";
import { getAdminAuth } from "@/lib/firebase-admin";
import { logAction } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/staff/:id — get a single staff member
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "staff", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  const where: Record<string, unknown> = {
    id,
    organizationId: ctx.organizationId,
  };

  // Restrict branch-scoped roles to their home branch
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
    where.branchId = ctx.branchId;
  }

  try {
    const staff = await prisma.staff.findFirst({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        staffType: true,
        employeeId: true,
        department: true,
        designation: true,
        dateOfBirth: true,
        gender: true,
        qualification: true,
        joinDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: { select: { permissions: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    if (!staff) return apiNotFound("Staff member");

    return apiSuccess(staff);
  } catch (error) {
    console.error("Get staff error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get staff member", 500);
  }
}

/**
 * PATCH /api/v1/staff/:id — update a staff member
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "staff", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const existingWhere: Record<string, unknown> = {
      id,
      organizationId: ctx.organizationId,
    };

    // Restrict branch-scoped roles to their home branch
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const existing = await prisma.staff.findFirst({ where: existingWhere });
    if (!existing) return apiNotFound("Staff member");

    const { name, email, phone, roleId, dateOfBirth, gender, qualification, joinDate, branchId, status, createAccount,      password,
      customPermissions,
      staffType,
    } = parsed.data;

    // If changing branch, verify it belongs to org
    if (branchId && branchId !== existing.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, organizationId: ctx.organizationId, isActive: true },
      });
      if (!branch) {
        return apiError("NOT_FOUND", "Branch not found", 404);
      }
    }

    let targetRoleName = existing.role;
    if (roleId) {
      const targetRole = await prisma.role.findFirst({
        where: {
          id: roleId,
          OR: [{ organizationId: ctx.organizationId }, { organizationId: null }]
        }
      });
      if (!targetRole) return apiError("NOT_FOUND", "Role not found", 404);
      targetRoleName = targetRole.name;
    }

    let newUserId: string | undefined;

    // Create User Login Account if requested and not already existing
    if (createAccount && !existing.userId && email && password) {
      if (!roleId) return apiError("BAD_REQUEST", "Role ID is required to create a system account", 400);
      
      const existingUser = await prisma.user.findFirst({
        where: { organizationId: ctx.organizationId, email },
      });
      if (existingUser) {
        return apiError("CONFLICT", "A user with this email already exists", 409);
      }

      const adminAuth = getAdminAuth();
      let firebaseUser;
      try {
        firebaseUser = await adminAuth.createUser({
          email,
          password,
          displayName: name || existing.name,
        });
      } catch (err: any) {
        if (err.code === "auth/email-already-exists") {
          return apiError("CONFLICT", "Email is already registered in the auth system", 409);
        }
        return apiError("INTERNAL_ERROR", "Failed to create auth account", 500);
      }

      try {
        const user = await prisma.user.create({
          data: {
            organizationId: ctx.organizationId,
            branchId: branchId || existing.branchId,
            firebaseUid: firebaseUser.uid,
            email,
            name: name || existing.name,
            phone: phone || existing.phone || null,
            roleId: roleId,
          }
        });
        newUserId = user.id;

        await logAction({
          organizationId: ctx.organizationId,
          branchId: branchId || existing.branchId,
          userId: ctx.userId,
          action: "CREATE",
          module: "USERS",
          entityId: user.id,
          details: { email, roleName: targetRoleName, context: "STAFF_UPDATE" },
        });
      } catch (dbError) {
        try {
          await adminAuth.deleteUser(firebaseUser.uid);
        } catch (e) {}
        return apiError("INTERNAL_ERROR", "Failed to create user record", 500);
      }
    }

    // If user already exists and a password reset is requested
    if (existing.userId && password) {
      const associatedUser = await prisma.user.findUnique({
        where: { id: existing.userId },
        include: { role: true },
      });
      if (associatedUser) {
        // Enforce Role Hierarchy Guard
        const getRoleWeight = (name: string) => {
          switch (name) {
            case "SUPER_ADMIN": return 100;
            case "SCHOOL_ADMIN": return 90;
            case "BRANCH_ADMIN": return 80;
            default: return 10;
          }
        };
        const callerWeight = getRoleWeight(ctx.roleName);
        const targetWeight = getRoleWeight(associatedUser.role.name);
        if (ctx.roleName !== "SUPER_ADMIN" && callerWeight <= targetWeight) {
          return apiError("FORBIDDEN", "Insufficient privileges to modify a user with an equal or higher role level", 403);
        }

        try {
          await getAdminAuth().updateUser(associatedUser.firebaseUid, { password });
          await prisma.user.update({
            where: { id: associatedUser.id },
            data: {
              forcePasswordChange: true,
              tokenVersion: { increment: 1 },
            },
          });
          await logAction({
            organizationId: ctx.organizationId,
            branchId: branchId || existing.branchId,
            userId: ctx.userId,
            action: "UPDATE",
            module: "USERS",
            entityId: associatedUser.id,
            details: { context: "STAFF_PASSWORD_RESET" },
          });
        } catch (err) {
          console.error("Firebase staff updateUser password error:", err);
          return apiError("INTERNAL_ERROR", "Failed to update credentials in authentication server", 500);
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email || null;
    if (phone !== undefined) data.phone = phone || null;
    if (roleId !== undefined) data.role = targetRoleName;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) data.gender = gender || null;
    if (qualification !== undefined) data.qualification = qualification || null;
    if (joinDate !== undefined) data.joinDate = joinDate ? new Date(joinDate) : null;
    if (branchId !== undefined) data.branchId = branchId;
    if (status !== undefined) data.status = status;
    if (staffType !== undefined) data.staffType = staffType;
    const targetUserId = newUserId || existing.userId;
    if (newUserId) data.userId = newUserId;

    if (targetUserId && customPermissions) {
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
        where: { userId: targetUserId }
      });

      // Insert new overrides if any
      if (customPermissions.length > 0) {
        await prisma.userPermission.createMany({
          data: customPermissions.map((p) => ({
            userId: targetUserId,
            permissionId: p.permissionId,
            granted: p.granted
          }))
        });
      }
    }

    const staff = await prisma.staff.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        employeeId: true,
        dateOfBirth: true,
        gender: true,
        qualification: true,
        joinDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        branch: { select: { id: true, name: true } },
      },
    });

    // Phase 6: Sync Data Drift
    if (staff.userId && (name !== undefined || email !== undefined)) {
      const syncData: Record<string, string> = {};
      if (name !== undefined) syncData.name = name;
      if (email !== undefined) syncData.email = email || "";

      await prisma.user.update({
        where: { id: staff.userId },
        data: syncData,
      });

      const linkedUser = await prisma.user.findFirst({ where: { id: staff.userId } });
      if (linkedUser && linkedUser.firebaseUid) {
        try {
          const fbUpdate: any = {};
          if (name !== undefined) fbUpdate.displayName = name;
          if (email !== undefined && email !== "") fbUpdate.email = email;
          
          if (Object.keys(fbUpdate).length > 0) {
            await getAdminAuth().updateUser(linkedUser.firebaseUid, fbUpdate);
          }
        } catch (err) {
          console.error("Firebase staff sync error:", err);
        }
      }
    }

    await logAction({
      organizationId: ctx.organizationId,
      branchId: staff.branch.id,
      userId: ctx.userId,
      action: "UPDATE",
      module: "STAFF",
      entityId: staff.id,
      details: { name: staff.name, employeeId: staff.employeeId, role: staff.role },
    });

    return apiSuccess(staff);
  } catch (error) {
    console.error("Update staff error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update staff member", 500);
  }
}

/**
 * DELETE /api/v1/staff/:id — soft-delete (set status to TERMINATED)
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "staff", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existingWhere: Record<string, unknown> = {
      id,
      organizationId: ctx.organizationId,
    };

    // Restrict branch-scoped roles to their home branch
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const existing = await prisma.staff.findFirst({ where: existingWhere });
    if (!existing) return apiNotFound("Staff member");

    await prisma.staff.update({
      where: { id },
      data: { status: "TERMINATED", deletedAt: new Date() },
    });

    // Phase 6: Lifecycle Deactivation (Sync Security)
    if (existing.userId) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { isActive: false },
      });

      const user = await prisma.user.findFirst({ where: { id: existing.userId } });
      if (user && user.firebaseUid) {
        try {
          await getAdminAuth().updateUser(user.firebaseUid, { disabled: true });
        } catch (err) {
          console.error("Firebase disable user error during staff termination:", err);
        }
      }
    }

    await logAction({
      organizationId: ctx.organizationId,
      branchId: existing.branchId,
      userId: ctx.userId,
      action: "DELETE",
      module: "STAFF",
      entityId: existing.id,
      details: { name: existing.name, employeeId: existing.employeeId, action: "TERMINATE" },
    });

    return apiSuccess({ id, terminated: true });
  } catch (error) {
    console.error("Delete staff error:", error);
    return apiError("INTERNAL_ERROR", "Failed to terminate staff member", 500);
  }
}
