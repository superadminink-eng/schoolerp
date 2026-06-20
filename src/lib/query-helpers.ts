import { prisma } from "./prisma";
import { hasPermission } from "./rbac";

export interface TenantContext {
  userId: string;
  roleId: string;
  roleName: string;
  organizationId: string;
  branchId: string | null;
}

/**
 * Builds the standard multi-tenancy and branch-scoping filter conditions.
 * Unconditionally enforces branch-scoping for branch-level roles.
 */
export async function buildTenantWhere(ctx: TenantContext, clientBranchId?: string | null): Promise<Record<string, any>> {
  const where: Record<string, any> = {
    organizationId: ctx.organizationId,
  };

  // Enforce branch isolation for branch-level roles dynamically
  const canViewAllBranches = await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "branches", "view_all");
  
  if (!canViewAllBranches && ctx.branchId) {
    where.branchId = ctx.branchId;
  } else if (clientBranchId && clientBranchId !== "ALL" && clientBranchId !== "__all__") {
    where.branchId = clientBranchId;
  }

  return where;
}

/**
 * Builds a search query filter using an OR block across specified fields.
 */
export function buildSearchWhere(search: string | null | undefined, fields: string[]): Record<string, any> {
  if (!search) return {};
  return {
    OR: fields.map((field) => ({
      [field]: { contains: search },
    })),
  };
}

/**
 * Helper to execute paginated DB queries with totals.
 */
export async function paginatedQuery(
  model: any,
  where: Record<string, any>,
  select: Record<string, any>,
  page: number,
  limit: number,
  orderBy: Record<string, any> = { createdAt: "desc" }
) {
  const [rows, total] = await Promise.all([
    model.findMany({
      where,
      select,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    model.count({ where }),
  ]);
  return { rows, total };
}
