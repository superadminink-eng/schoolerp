import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createSubjectMasterSchema } from "@/lib/validations/subject-master";

/**
 * GET /api/v1/subject-masters — list subject masters for an organization
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "subjects", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const activeOnly = url.searchParams.get("active") !== "false";

  try {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };
    if (activeOnly) {
      where.isActive = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const subjectMasters = await prisma.subjectMaster.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return apiSuccess(subjectMasters);
  } catch (error) {
    console.error("List subject masters error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list subject masters", 500);
  }
}

/**
 * POST /api/v1/subject-masters — create a new subject master
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "subjects", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createSubjectMasterSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, code, type, description } = parsed.data;

  try {
    // Check for unique name or code per org
    const existing = await prisma.subjectMaster.findFirst({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { code },
          { name: name.trim() }
        ]
      }
    });

    if (existing) {
      if (existing.isActive) {
        if (existing.code === code) {
          return apiError("CONFLICT", `A subject with code "${code}" already exists`, 409);
        } else {
          return apiError("CONFLICT", `A subject with the name "${name}" already exists`, 409);
        }
      } else {
        // Return special code for smart reactivation
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ARCHIVED_CONFLICT",
              message: `A subject with the ${existing.code === code ? `code "${code}"` : `name "${name}"`} already exists in your Archives.`,
              meta: { duplicateId: existing.id },
            },
          },
          { status: 409 }
        );
      }
    }

    const subjectMaster = await prisma.subjectMaster.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        code,
        type,
        description: description || null,
      },
    });

    return apiSuccess(subjectMaster, undefined, 201);
  } catch (error) {
    console.error("Create subject master error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create subject master", 500);
  }
}
