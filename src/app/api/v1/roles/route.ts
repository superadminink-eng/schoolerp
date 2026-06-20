import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext, hasPermission, getUserPermissions } from "@/lib/rbac";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(2, "Name is required").max(50),
  description: z.string().optional(),
  type: z.enum(["STAFF", "STUDENT", "PARENT"]).default("STAFF"),
  permissions: z.array(z.string()).min(1, "At least one permission is required"),
});

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  const roleId = req.headers.get("x-user-role-id");
  const roleName = req.headers.get("x-user-role-name");

  if (!userId || !roleId || !roleName) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const isAllowed = 
    roleName === "SUPER_ADMIN" ||
    await hasPermission(userId, roleId, roleName, "settings", "manage") ||
    await hasPermission(userId, roleId, roleName, "staff", "read") ||
    await hasPermission(userId, roleId, roleName, "staff", "create") ||
    await hasPermission(userId, roleId, roleName, "staff", "update") ||
    await hasPermission(userId, roleId, roleName, "users", "read") ||
    await hasPermission(userId, roleId, roleName, "users", "create") ||
    await hasPermission(userId, roleId, roleName, "users", "update");

  if (!isAllowed) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 }
    );
  }

  const ctx = getTenantContext(req);
  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");

  try {
    const whereClause: any = {
      OR: [
        { organizationId: ctx.organizationId },
        { organizationId: null }, // System roles
      ]
    };

    if (typeFilter) {
      const upperType = typeFilter.toUpperCase();
      if (["STAFF", "STUDENT", "PARENT"].includes(upperType)) {
        whereClause.type = upperType;
      }
    }

    const roles = await prisma.role.findMany({
      where: whereClause,
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Phase 5: The "Shadow Override" Filtering Logic
    const overriddenIds = new Set(roles.map(r => r.overridesRoleId).filter(Boolean));
    const finalRoles = roles.filter(r => !(r.organizationId === null && overriddenIds.has(r.id)));

    return apiSuccess(finalRoles);
  } catch (error) {
    console.error("List roles error:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch roles", 500);
  }
}

export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "settings", "manage");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, description, type, permissions } = parsed.data;

  // Cannot create SUPER_ADMIN or other system roles
  if (name.toUpperCase() === "SUPER_ADMIN" || name.toUpperCase() === "SCHOOL_ADMIN") {
    return apiError("FORBIDDEN", "Cannot create system roles", 403);
  }

  try {
    // Check name uniqueness
    const existing = await prisma.role.findFirst({
      where: {
        name,
        OR: [
          { organizationId: ctx.organizationId },
          { organizationId: null }
        ]
      }
    });

    if (existing) {
      return apiError("CONFLICT", "A role with this name already exists", 409);
    }

    // Resolve permission IDs
    const permRecords = await prisma.permission.findMany({
      where: {
        id: { in: permissions }
      }
    });

    if (permRecords.length !== permissions.length) {
      return apiError("BAD_REQUEST", "One or more permissions are invalid", 400);
    }

    // ZERO-TRUST PRIVILEGE ESCALATION CHECK
    if (ctx.roleName !== "SUPER_ADMIN") {
      const callerPerms = await getUserPermissions(ctx.userId, ctx.roleId, ctx.roleName);
      for (const p of permRecords) {
        if (!callerPerms.has(`${p.module}:${p.action}`)) {
          return apiError("FORBIDDEN", `Cannot delegate unauthorized permission: ${p.module}:${p.action}`, 403);
        }
      }
    }

    const role = await prisma.role.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        description,
        type,
        isSystem: false,
        rolePermissions: {
          create: permissions.map(permId => ({
            permissionId: permId
          }))
        }
      },
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      }
    });

    return apiSuccess(role, undefined, 201);
  } catch (error) {
    console.error("Create role error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create role", 500);
  }
}
