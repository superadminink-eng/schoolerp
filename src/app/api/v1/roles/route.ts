import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(2, "Name is required").max(50),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, "At least one permission is required"),
});

export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "settings", "manage");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  try {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { organizationId: ctx.organizationId },
          { organizationId: null }, // System roles
        ]
      },
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return apiSuccess(roles);
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

  const { name, description, permissions } = parsed.data;

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

    const role = await prisma.role.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        description,
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
