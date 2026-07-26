import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission } from "@/lib/rbac";

type RouteContext = any;

/**
 * GET /api/v1/classes/:id/sections — list sections for a class
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "students", "read");
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const classRecord = await prisma.class.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!classRecord) {
      return apiError("NOT_FOUND", "Class not found", 404);
    }

    const sections = await prisma.section.findMany({
      where: { classId: id },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return apiSuccess(sections);
  } catch (error) {
    console.error("List sections error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list sections", 500);
  }
}
