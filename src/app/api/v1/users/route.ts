import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createUserSchema } from "@/lib/validations/user";
import { logAction } from "@/lib/audit";

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

  // BRANCH_ADMIN can only see users in their branch
  if (ctx.role === "BRANCH_ADMIN" && ctx.branchId) {
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
  const denied = await checkApiPermission(req, "users", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, email, phone, roleId, branchId, password } = parsed.data;

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

  // Cannot create SUPER_ADMIN (defensive check)
  if (targetRole.name === "SUPER_ADMIN") {
    return apiError("FORBIDDEN", "Cannot create a SUPER_ADMIN user", 403);
  }

  // BRANCH_ADMIN can only create users in their own branch
  if (ctx.role === "BRANCH_ADMIN" && ctx.branchId && branchId !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot create users in another branch", 403);
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
}
