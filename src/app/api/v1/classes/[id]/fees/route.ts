import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission } from "@/lib/rbac";

type RouteContext = any;

/**
 * GET /api/v1/classes/:id/fees — list fees for a class (for student form)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "fees", "read");
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

    const feeStructures = await prisma.feeStructure.findMany({
      where: { classId: id },
      include: {
        feeCategory: { select: { name: true } },
      },
    });

    const fees = feeStructures.map((fs) => ({
      id: fs.id,
      name: fs.feeCategory.name,
      amount: Number(fs.amount),
      frequency: fs.frequency,
      applicability: fs.applicability,
    }));

    return apiSuccess(fees);
  } catch (error) {
    console.error("List class fees error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list fees", 500);
  }
}
