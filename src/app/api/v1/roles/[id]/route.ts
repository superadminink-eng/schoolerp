import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext, getUserPermissions } from "@/lib/rbac";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().optional(),
  type: z.enum(["STAFF", "STUDENT", "PARENT"]).optional(),
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

  const { name, description, type, permissions } = parsed.data;

  try {
    const existing = await prisma.role.findFirst({
      where: { id, organizationId: ctx.organizationId }
    });

    if (!existing) {
      // System roles can be modified ONLY by platform SUPER_ADMIN, and ONLY for permissions
      const systemRole = await prisma.role.findFirst({ where: { id, organizationId: null } });
      if (systemRole) {
        if (ctx.roleName !== "SUPER_ADMIN") {
          // Phase 5: Shadow Override (Copy-on-Write)
          if (!permissions) {
             return apiError("BAD_REQUEST", "You must provide permissions when customizing a system role", 400);
          }
          const permRecords = await prisma.permission.findMany({
            where: { id: { in: permissions } }
          });
          if (permRecords.length !== permissions.length) {
            return apiError("BAD_REQUEST", "One or more permissions are invalid", 400);
          }

          // Privilege escalation check
          const callerPerms = await getUserPermissions(ctx.userId, ctx.roleId, ctx.roleName);
          for (const p of permRecords) {
            if (!callerPerms.has(`${p.module}:${p.action}`)) {
              return apiError("FORBIDDEN", `Cannot delegate unauthorized permission: ${p.module}:${p.action}`, 403);
            }
          }

          const newRole = await prisma.$transaction(async (tx) => {
             const custom = await tx.role.create({
                data: {
                   organizationId: ctx.organizationId,
                   name: systemRole.name,
                   description: systemRole.description,
                   type: systemRole.type,
                   isSystem: false,
                   overridesRoleId: systemRole.id,
                   rolePermissions: {
                      create: permRecords.map(p => ({ permissionId: p.id }))
                   }
                }
             });

             await tx.user.updateMany({
                where: { organizationId: ctx.organizationId, roleId: systemRole.id },
                data: { roleId: custom.id }
             });

             return custom;
          });

          return apiSuccess(newRole);
        }
        if (name !== undefined || description !== undefined || type !== undefined) {
          return apiError("BAD_REQUEST", "Cannot modify system role metadata (name, description, or type)", 400);
        }
      } else {
        return apiNotFound("Role");
      }
    }

    if (name) {
      const nameCheck = await prisma.role.findFirst({
        where: {
          name,
          id: { not: id },
          OR: [{ organizationId: ctx.organizationId }, { organizationId: null }]
        }
      });
      if (nameCheck) {
        // Phase 5: Allow conflict if the name matches the exact system role being overridden
        const isSelfOverride = existing && existing.overridesRoleId === nameCheck.id;
        if (!isSelfOverride) {
          return apiError("CONFLICT", "A role with this name already exists", 409);
        }
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;

    if (permissions) {
      const permRecords = await prisma.permission.findMany({
        where: { id: { in: permissions } }
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

    if (existing.overridesRoleId) {
      // Phase 5: Restore-to-Default Migration
      await prisma.user.updateMany({
        where: { roleId: existing.id },
        data: { roleId: existing.overridesRoleId }
      });
    } else if (existing._count.users > 0) {
      return apiError("CONFLICT", "Cannot delete role because it is assigned to users", 409);
    }

    await prisma.role.delete({ where: { id } });

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    console.error("Delete role error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete role", 500);
  }
}
