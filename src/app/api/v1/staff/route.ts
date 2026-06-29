import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { buildTenantWhere, buildSearchWhere } from "@/lib/query-helpers";
import { createStaffSchema } from "@/lib/validations/staff";
import crypto from "crypto";
import { getAdminAuth } from "@/lib/firebase-admin";
import { logAction } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";

/**
 * GET /api/v1/staff — list staff with pagination, search, and filters
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "staff", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const role = url.searchParams.get("role");
  const branchId = url.searchParams.get("branchId");
  const status = url.searchParams.get("status");
  const staffType = url.searchParams.get("staffType");

  const where: Record<string, any> = {
    ...(await buildTenantWhere(ctx as any, branchId)),
    ...(role && { role }),
    ...(status && { status }),
    ...(staffType && { staffType }),
    ...buildSearchWhere(search, ["name", "email"]),
  };

  try {
    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          staffType: true,
          gender: true,
          joinDate: true,
          status: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.staff.count({ where }),
    ]);

    return apiSuccess(staff, { page, limit, total });
  } catch (error) {
    console.error("List staff error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list staff", 500);
  }
}

/**
 * POST /api/v1/staff — create a new staff member
 */
export async function POST(req: NextRequest) {
  return withIdempotency(req, async (clonedReq) => {
    const denied = await checkApiPermission(clonedReq, "staff", "create");
    if (denied) return denied;

    const ctx = getTenantContext(clonedReq);

    let body: unknown;
    try {
      body = await clonedReq.json();
    } catch {
      return apiError("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    const {
      name,
      email,
      phone,
      roleId,
      dateOfBirth,
      gender,
      qualification,
      joinDate,
      branchId,
      createAccount,
      existingUserId,
      password,
      customPermissions,
      staffType,
    } = parsed.data;

    // Restrict branch-scoped roles from creating staff in another branch
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && branchId !== ctx.branchId) {
      return apiError("FORBIDDEN", "Cannot create staff in another branch", 403);
    }

    try {
      // Verify branch belongs to this organization
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, organizationId: ctx.organizationId, isActive: true },
      });
      if (!branch) {
        return apiError("NOT_FOUND", "Branch not found", 404);
      }

      // Verify role exists
      const targetRole = await prisma.role.findFirst({
        where: {
          id: roleId,
          OR: [{ organizationId: ctx.organizationId }, { organizationId: null }]
        }
      });
      if (!targetRole) {
        return apiError("NOT_FOUND", "Role not found", 404);
      }

      // Hierarchy Enforcement
      if (targetRole.name === "SUPER_ADMIN" && ctx.roleName !== "SUPER_ADMIN") {
        return apiError("FORBIDDEN", "Only Super Admins can assign the Super Admin role", 403);
      }
      if (targetRole.name === "SCHOOL_ADMIN" && !["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(ctx.roleName)) {
        return apiError("FORBIDDEN", "Insufficient permissions to assign School Admin role", 403);
      }
      if (targetRole.name === "BRANCH_ADMIN" && !["SUPER_ADMIN", "SCHOOL_ADMIN", "BRANCH_ADMIN"].includes(ctx.roleName)) {
        return apiError("FORBIDDEN", "Insufficient permissions to assign Branch Admin role", 403);
      }

      let userId: string | undefined;

      // Link Existing User Account
      if (existingUserId) {
        const existingUser = await prisma.user.findFirst({
          where: {
            id: existingUserId,
            organizationId: ctx.organizationId,
            isActive: true,
            staff: null,
            parent: null,
            student: null,
          }
        });
        
        if (!existingUser) {
          return apiError("NOT_FOUND", "User not found or already linked", 404);
        }
        
        userId = existingUser.id;
        
        // Update user's role and branch if needed to match staff placement
        await prisma.user.update({
          where: { id: userId },
          data: {
            roleId,
            branchId,
            tokenVersion: { increment: 1 } // Force re-login with new role
          }
        });

        // Apply custom permissions if provided
        if (customPermissions) {
          await prisma.userPermission.deleteMany({ where: { userId } });
          if (customPermissions.length > 0) {
            await prisma.userPermission.createMany({
              data: customPermissions.map((p) => ({
                userId: userId as string,
                permissionId: p.permissionId,
                granted: p.granted
              }))
            });
          }
        }

      } else if (createAccount && email && password) {
        // Create User Login Account if requested
        const existing = await prisma.user.findFirst({
          where: { organizationId: ctx.organizationId, email },
        });
        if (existing) {
          return apiError("CONFLICT", "A user with this email already exists", 409);
        }

        const adminAuth = getAdminAuth();
        let firebaseUser;
        try {
          firebaseUser = await adminAuth.createUser({
            email,
            password,
            displayName: name,
          });
        } catch (err: any) {
          if (err.code === "auth/email-already-exists") {
            return apiError("CONFLICT", "Email is already registered in the auth system", 409);
          }
          console.error("Firebase staff creation error:", err);
          return apiError("INTERNAL_ERROR", "Failed to create auth account", 500);
        }

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
            }
          });
          userId = user.id;

          await logAction({
            organizationId: ctx.organizationId,
            branchId,
            userId: ctx.userId,
            action: "CREATE",
            module: "USERS",
            entityId: user.id,
            details: { email, roleName: targetRole.name, context: "STAFF_CREATION" },
          });
        } catch (dbError) {
          try {
            await adminAuth.deleteUser(firebaseUser.uid);
          } catch (e) {}
          console.error("DB create user error:", dbError);
          return apiError("INTERNAL_ERROR", "Failed to create user record", 500);
        }
      }

      // Auto-generate employeeId with retry logic
      let employeeId = "";
      for (let i = 0; i < 5; i++) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
        employeeId = `STF-${dateStr}-${randomSuffix}`;
        const exists = await prisma.staff.findFirst({ where: { employeeId }, select: { id: true } });
        if (!exists) break;
      }
      if (!employeeId) {
        employeeId = `STF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      }

      const staff = await prisma.staff.create({
        data: {
          branchId,
          organizationId: ctx.organizationId,
          employeeId,
          userId,
          name,
          email: email || null,
          phone: phone || null,
          role: targetRole.name, // Store string name for legacy compatibility
          staffType,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          qualification: qualification || null,
          joinDate: joinDate ? new Date(joinDate) : new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          employeeId: true,
          gender: true,
          joinDate: true,
          status: true,
          branch: { select: { id: true, name: true } },
        },
      });

      await logAction({
        organizationId: ctx.organizationId,
        branchId: staff.branch.id,
        userId: ctx.userId,
        action: "CREATE",
        module: "STAFF",
        entityId: staff.id,
        details: { name: staff.name, employeeId: staff.employeeId, role: staff.role },
      });

      return apiSuccess(staff, undefined, 201);
    } catch (error) {
      console.error("Create staff error:", error);
      return apiError("INTERNAL_ERROR", "Failed to create staff", 500);
    }
  });
}
