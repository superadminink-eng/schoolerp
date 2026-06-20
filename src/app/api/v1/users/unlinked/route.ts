import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "users", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  try {
    const unlinkedUsers = await prisma.user.findMany({
      where: {
        organizationId: ctx.organizationId,
        isActive: true,
        staff: null,
        parent: null,
        student: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { name: "asc" }
    });

    return apiSuccess(unlinkedUsers);
  } catch (error) {
    console.error("Get unlinked users error:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch unlinked users", 500);
  }
}
