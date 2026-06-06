import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission, hasPermission } from "@/lib/rbac";

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
    await hasPermission(userId, roleId, roleName, "staff", "create") ||
    await hasPermission(userId, roleId, roleName, "staff", "update") ||
    await hasPermission(userId, roleId, roleName, "users", "create") ||
    await hasPermission(userId, roleId, roleName, "users", "update");

  if (!isAllowed) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 }
    );
  }

  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { action: 'asc' }
      ]
    });

    return apiSuccess(permissions);
  } catch (error) {
    console.error("List permissions error:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch permissions", 500);
  }
}
