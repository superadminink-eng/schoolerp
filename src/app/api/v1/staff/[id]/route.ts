import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
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
    branch: { organizationId: ctx.organizationId },
  };

  // BRANCH_ADMIN can only see staff in their branch
  if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
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
      branch: { organizationId: ctx.organizationId },
    };

    // BRANCH_ADMIN can only edit staff in their branch
    if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const existing = await prisma.staff.findFirst({ where: existingWhere });
    if (!existing) return apiNotFound("Staff member");

    const { name, email, phone, roleId, dateOfBirth, gender, qualification, joinDate, branchId, status, createAccount, password, customPermissions } = parsed.data;

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
    const targetUserId = newUserId || existing.userId;
    if (newUserId) data.userId = newUserId;

    if (targetUserId && customPermissions) {
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
      branch: { organizationId: ctx.organizationId },
    };

    // BRANCH_ADMIN can only delete staff in their branch
    if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const existing = await prisma.staff.findFirst({ where: existingWhere });
    if (!existing) return apiNotFound("Staff member");

    await prisma.staff.update({
      where: { id },
      data: { status: "TERMINATED" },
    });

    return apiSuccess({ id, terminated: true });
  } catch (error) {
    console.error("Delete staff error:", error);
    return apiError("INTERNAL_ERROR", "Failed to terminate staff member", 500);
  }
}
