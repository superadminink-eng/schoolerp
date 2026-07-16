import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateBranchSchema } from "@/lib/validations/branch";

type RouteContext = any;

/**
 * GET /api/v1/branches/:id — get a single branch
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "branches", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  // Restrict branch-scoped roles to their home branch
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && id !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot access details of another branch", 403);
  }

  try {
    const branch = await prisma.branch.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        isMain: true,
        isActive: true,
        hasEntranceTest: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!branch) return apiNotFound("Branch");

    return apiSuccess(branch);
  } catch (error) {
    console.error("Get branch error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get branch", 500);
  }
}

/**
 * PATCH /api/v1/branches/:id — update a branch
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "branches", "manage");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  // Restrict branch-scoped roles to their home branch
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && id !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot access details of another branch", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateBranchSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const existing = await prisma.branch.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Branch");

    const { name, code, address, phone, email, isActive, hasEntranceTest } = parsed.data;

    // Check code uniqueness if changing
    if (code && code !== existing.code) {
      const duplicate = await prisma.branch.findFirst({
        where: { organizationId: ctx.organizationId, code, NOT: { id } },
      });
      if (duplicate) {
        return apiError("CONFLICT", "A branch with this code already exists", 409);
      }
    }

    // Cannot deactivate the main branch
    if (isActive === false && existing.isMain) {
      return apiError("FORBIDDEN", "Cannot deactivate the main branch", 403);
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (address !== undefined) data.address = address || null;
    if (phone !== undefined) data.phone = phone || null;
    if (email !== undefined) data.email = email || null;
    if (isActive !== undefined) data.isActive = isActive;
    if (hasEntranceTest !== undefined) data.hasEntranceTest = hasEntranceTest;

    const branch = await prisma.branch.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        isMain: true,
        isActive: true,
        hasEntranceTest: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess(branch);
  } catch (error) {
    console.error("Update branch error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update branch", 500);
  }
}

/**
 * DELETE /api/v1/branches/:id — soft-delete (deactivate) a branch
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "branches", "manage");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  // Restrict branch-scoped roles to their home branch
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && id !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot access details of another branch", 403);
  }

  try {
    const existing = await prisma.branch.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Branch");

    // Cannot delete the main branch
    if (existing.isMain) {
      return apiError("FORBIDDEN", "Cannot deactivate the main branch", 403);
    }

    await prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    return apiSuccess({ id, deactivated: true });
  } catch (error) {
    console.error("Delete branch error:", error);
    return apiError("INTERNAL_ERROR", "Failed to deactivate branch", 500);
  }
}
