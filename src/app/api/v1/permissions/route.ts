import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  // Only users who can manage settings can fetch all permissions
  const denied = await checkApiPermission(req, "settings", "manage");
  if (denied) return denied;

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
