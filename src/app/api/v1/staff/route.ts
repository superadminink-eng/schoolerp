import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createStaffSchema } from "@/lib/validations/staff";
import crypto from "crypto";
import { getAdminAuth } from "@/lib/firebase-admin";
import { logAction } from "@/lib/audit";

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

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };

  // Restrict branch-scoped roles to their home branch
  if (ctx.branchId && branchId !== "__all__") {
    where.branchId = ctx.branchId;
  } else if (branchId && branchId !== "ALL" && branchId !== "__all__") {
    where.branchId = branchId;
  }

  if (role) {
    where.role = role;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

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
  const denied = await checkApiPermission(req, "staff", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, email, phone, roleId, dateOfBirth, gender, qualification, joinDate, branchId, createAccount, password, customPermissions } = parsed.data;

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

    let userId: string | undefined;

    // Create User Login Account if requested
    if (createAccount && email && password) {
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
}
