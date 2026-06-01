import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1).optional(),
});

export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "settings", "manage");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const role = await prisma.role.findFirst({
      where: {
        id,
        OR: [
          { organizationId: ctx.organizationId },
          { organizationId: null },
        ]
      },
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      }
    });

    if (!role) return apiNotFound("Role");

    return apiSuccess(role);
  } catch (error) {
    console.error("Get role error:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch role", 500);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "settings", "manage");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, description, permissions } = parsed.data;

  try {
    const existing = await prisma.role.findFirst({
      where: { id, organizationId: ctx.organizationId }
    });

    if (!existing) {
      // System roles cannot be modified by users
      const systemRole = await prisma.role.findFirst({ where: { id, organizationId: null } });
      if (systemRole) return apiError("FORBIDDEN", "Cannot modify system roles", 403);
      
      return apiNotFound("Role");
    }

    if (name) {
      const nameCheck = await prisma.role.findFirst({
        where: {
          name,
          id: { not: id },
          OR: [{ organizationId: ctx.organizationId }, { organizationId: null }]
        }
      });
      if (nameCheck) return apiError("CONFLICT", "A role with this name already exists", 409);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (permissions) {
      const permRecords = await prisma.permission.findMany({
        where: { id: { in: permissions } }
      });
      if (permRecords.length !== permissions.length) {
        return apiError("BAD_REQUEST", "One or more permissions are invalid", 400);
      }

      // Delete old permissions and set new ones
      updateData.rolePermissions = {
        deleteMany: {},
        create: permissions.map(permId => ({
          permissionId: permId
        }))
      };
    }

    const role = await prisma.role.update({
      where: { id },
      data: updateData,
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      }
    });

    return apiSuccess(role);
  } catch (error) {
    console.error("Update role error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update role", 500);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "settings", "manage");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existing = await prisma.role.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { _count: { select: { users: true } } }
    });

    if (!existing) {
      const systemRole = await prisma.role.findFirst({ where: { id, organizationId: null } });
      if (systemRole) return apiError("FORBIDDEN", "Cannot delete system roles", 403);
      return apiNotFound("Role");
    }

    if (existing._count.users > 0) {
      return apiError("CONFLICT", "Cannot delete role because it is assigned to users", 409);
    }

    await prisma.role.delete({ where: { id } });

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    console.error("Delete role error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete role", 500);
  }
}
