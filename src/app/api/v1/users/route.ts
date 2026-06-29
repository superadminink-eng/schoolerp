import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext, hasPermission, getUserPermissions } from "@/lib/rbac";
import { createUserSchema } from "@/lib/validations/user";
import { logAction } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";

/**
 * GET /api/v1/users — list users with pagination, search, and filters
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "users", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const roleId = url.searchParams.get("roleId");
  const branchId = url.searchParams.get("branchId");

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };

  // Check dynamic cross-branch view permission
  const canViewAllBranches = await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "branches", "view_all");

  // Restrict branch-scoped roles to their home branch
  if (!canViewAllBranches && ctx.branchId) {
    where.branchId = ctx.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  if (roleId) {
    where.roleId = roleId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: { select: { id: true, name: true } },
          isActive: true,
          createdAt: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return apiSuccess(users, { page, limit, total });
  } catch (error) {
    console.error("List users error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list users", 500);
  }
}

/**
 * POST /api/v1/users — create a new user (Firebase account + DB record)
 */
export async function POST(req: NextRequest) {
  return withIdempotency(req, async (clonedReq) => {
    const denied = await checkApiPermission(clonedReq, "users", "create");
    if (denied) return denied;

    const ctx = getTenantContext(clonedReq);

    let body: unknown;
    try {
      body = await clonedReq.json();
    } catch {
      return apiError("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    const { name, email, phone, roleId, branchId, password, customPermissions } = parsed.data;

    // Validate the role exists in this organization (or is a system role)
    const targetRole = await prisma.role.findFirst({
      where: { 
        id: roleId,
        OR: [{ organizationId: ctx.organizationId }, { organizationId: null }]
      },
    });

    if (!targetRole) {
      return apiError("NOT_FOUND", "Role not found", 404);
    }

    // Cannot create SUPER_ADMIN unless caller is SUPER_ADMIN (Handover Process)
    if (targetRole.name === "SUPER_ADMIN" && ctx.roleName !== "SUPER_ADMIN") {
      return apiError("FORBIDDEN", "Only Super Admins can create another Super Admin", 403);
    }

    // Restrict assigning SCHOOL_ADMIN role to only SUPER_ADMIN or SCHOOL_ADMIN callers
    if (targetRole.name === "SCHOOL_ADMIN") {
      if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN") {
        return apiError("FORBIDDEN", "Insufficient privileges to assign the SCHOOL_ADMIN role", 403);
      }
    }

    // Check dynamic cross-branch manage permission
    const canManageAllBranches = await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "branches", "manage");

    // Restrict branch-scoped roles from creating users in another branch
    if (!canManageAllBranches && ctx.branchId && branchId !== ctx.branchId) {
      return apiError("FORBIDDEN", "Cannot create users in another branch", 403);
    }
    
    if (customPermissions && customPermissions.length > 0) {
      // Security Gate: Ensure caller has the permissions they are trying to grant
      if (ctx.roleName !== "SUPER_ADMIN") {
        const callerPerms = await getUserPermissions(ctx.userId, ctx.roleId, ctx.roleName);
        const permissionsToVerify = await prisma.permission.findMany({
          where: { id: { in: customPermissions.map(p => p.permissionId) } }
        });
        for (const perm of permissionsToVerify) {
          const permKey = `${perm.module}:${perm.action}`;
          if (!callerPerms.has(permKey)) {
            return apiError("FORBIDDEN", `Cannot grant permission "${permKey}" that you do not possess`, 403);
          }
        }
      }
    }

    try {
      // Verify branch belongs to this organization
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, organizationId: ctx.organizationId, isActive: true },
      });
      if (!branch) {
        return apiError("NOT_FOUND", "Branch not found", 404);
      }

      // Check email uniqueness within organization
      const existing = await prisma.user.findFirst({
        where: { organizationId: ctx.organizationId, email },
      });
      if (existing) {
        return apiError("CONFLICT", "A user with this email already exists", 409);
      }

      // 1. Create Firebase account
      const adminAuth = getAdminAuth();
      let firebaseUser;
      try {
        firebaseUser = await adminAuth.createUser({
          email,
          password,
          displayName: name,
        });
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      if (fbErr.code === "auth/email-already-exists") {
        return apiError("CONFLICT", "This email is already registered in the auth system", 409);
      }
      console.error("Firebase createUser error:", err);
      return apiError("INTERNAL_ERROR", "Failed to create auth account", 500);
    }

    // 2. Create Prisma User record
    try {
      const user = await prisma.user.create({
        data: {
          organizationId: ctx.organizationId,
          branchId,
          firebaseUid: firebaseUser.uid,
          email,
          name,
          phone: phone || null,
          roleId: roleId,
          permissions: customPermissions && customPermissions.length > 0 ? {
            create: customPermissions.map(p => ({
              permissionId: p.permissionId,
              granted: p.granted
            }))
          } : undefined
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: { select: { id: true, name: true } },
          isActive: true,
          branchId: true,
          createdAt: true,
        },
      });

      await logAction({
        organizationId: ctx.organizationId,
        branchId,
        userId: ctx.userId,
        action: "CREATE",
        module: "USERS",
        entityId: user.id,
        details: { email, roleName: targetRole.name },
      });

      return apiSuccess(user, undefined, 201);
    } catch (dbError) {
      // Rollback: delete the Firebase account
      try {
        await adminAuth.deleteUser(firebaseUser.uid);
      } catch (rollbackErr) {
        console.error("Firebase rollback failed:", rollbackErr);
      }
      console.error("DB create user error:", dbError);
      return apiError("INTERNAL_ERROR", "Failed to create user record", 500);
    }
  } catch (error) {
    console.error("Create user error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create user", 500);
  }
  });
}
