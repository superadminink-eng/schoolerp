import { prisma } from "./prisma";
import { rbacCache, CACHE_TTLS } from "./rbac-cache";

/**
 * Check if a user has a specific permission.
 * Resolution: user override → role default → deny (with memory caching)
 */
export async function hasPermission(
  userId: string,
  roleId: string,
  roleName: string,
  module: string,
  action: string
): Promise<boolean> {
  if (roleName === "SUPER_ADMIN" || roleName === "SCHOOL_ADMIN") return true;

  const cacheKey = `perm:${userId}:${roleId}:${module}:${action}`;
  const cachedVal = rbacCache.get<boolean>(cacheKey);
  if (cachedVal !== null) {
    return cachedVal;
  }

  // Check user-level override
  const userPerm = await prisma.userPermission.findFirst({
    where: {
      userId,
      permission: { module, action },
    },
  });
  if (userPerm) {
    rbacCache.set(cacheKey, userPerm.granted, CACHE_TTLS.PERMISSION);
    return userPerm.granted;
  }

  // Check role default
  const rolePerm = await prisma.rolePermission.findFirst({
    where: {
      roleId,
      permission: { module, action },
    },
  });
  const allowed = !!rolePerm;
  rbacCache.set(cacheKey, allowed, CACHE_TTLS.PERMISSION);
  return allowed;
}

/**
 * Get all permissions for a user (merged: role defaults + user overrides).
 * Returns a Set of "module:action" strings.
 */
export async function getUserPermissions(
  userId: string,
  roleId: string,
  roleName: string
): Promise<Set<string>> {
  if (roleName === "SUPER_ADMIN" || roleName === "SCHOOL_ADMIN") {
    const allPerms = await prisma.permission.findMany();
    return new Set(allPerms.map((p) => `${p.module}:${p.action}`));
  }

  // Get role defaults
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  const permMap = new Map<string, boolean>();
  for (const rp of rolePerms) {
    permMap.set(`${rp.permission.module}:${rp.permission.action}`, true);
  }

  // Apply user overrides
  const userPerms = await prisma.userPermission.findMany({
    where: { userId },
    include: { permission: true },
  });
  for (const up of userPerms) {
    const key = `${up.permission.module}:${up.permission.action}`;
    if (up.granted) {
      permMap.set(key, true);
    } else {
      permMap.delete(key);
    }
  }

  return new Set(permMap.keys());
}

/**
 * Permission check for API routes. Returns a 403 Response if denied, or null if allowed.
 */
export async function checkApiPermission(
  req: Request,
  module: string,
  action: string
): Promise<Response | null> {
  const userId = req.headers.get("x-user-id");
  const roleId = req.headers.get("x-user-role-id");
  const roleName = req.headers.get("x-user-role-name");
  const tokenVersionStr = req.headers.get("x-token-version");

  if (!userId || !roleId || !roleName || !tokenVersionStr) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  // Check if user and organization are active (Instant Revocation Check with brief caching)
  const statusCacheKey = `status:${userId}`;
  let isUserActive = rbacCache.get<boolean>(statusCacheKey);

  if (isUserActive === null) {
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: {
        tokenVersion: true,
        organization: { select: { isActive: true } }
      }
    });
    isUserActive = !!(user && user.organization.isActive && user.tokenVersion === parseInt(tokenVersionStr, 10));
    rbacCache.set(statusCacheKey, isUserActive, CACHE_TTLS.USER_STATUS);
  }

  if (!isUserActive) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "User or organization is suspended" } },
      { status: 401 }
    );
  }

  const allowed = await hasPermission(userId, roleId, roleName, module, action);
  if (!allowed) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 }
    );
  }

  return null; // Allowed — proceed
}

/**
 * Extract tenant context from request headers (set by middleware).
 */
export function getTenantContext(req: Request) {
  return {
    userId: req.headers.get("x-user-id")!,
    roleId: req.headers.get("x-user-role-id")!,
    roleName: req.headers.get("x-user-role-name")!,
    organizationId: req.headers.get("x-organization-id")!,
    branchId: req.headers.get("x-branch-id") || null,
    tokenVersion: parseInt(req.headers.get("x-token-version") || "0", 10),
  };
}
