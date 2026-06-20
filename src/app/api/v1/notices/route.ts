import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { buildTenantWhere, buildSearchWhere } from "@/lib/query-helpers";
import { createNoticeSchema } from "@/lib/validations/notice";
import { logAction } from "@/lib/audit";

/**
 * GET /api/v1/notices — list notices with pagination, search, and filters
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "notices", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const branchId = url.searchParams.get("branchId");

  const where: Record<string, any> = {
    ...(await buildTenantWhere(ctx as any, branchId)),
    ...buildSearchWhere(search, ["title", "content"]),
  };

  try {
    const [rows, total, publishedCount, draftCount, parentTargetCount] = await Promise.all([
      prisma.notice.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notice.count({ where }),
      prisma.notice.count({ where: { ...where, isPublished: true } }),
      prisma.notice.count({ where: { ...where, isPublished: false } }),
      prisma.notice.count({
        where: {
          ...where,
          targetRoles: { contains: "PARENT" },
        },
      }),
    ]);

    const mappedRows = rows.map((row) => {
      let parsedRoles: string[] = [];
      try {
        parsedRoles = JSON.parse(row.targetRoles);
      } catch {
        parsedRoles = [];
      }
      return {
        ...row,
        targetRoles: parsedRoles,
      };
    });

    return apiSuccess(mappedRows, {
      page,
      limit,
      total,
      stats: {
        published: publishedCount,
        draft: draftCount,
        parentTarget: parentTargetCount,
      } as any,
    });
  } catch (error) {
    console.error("List notices error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list notices", 500);
  }
}

/**
 * POST /api/v1/notices — create a new notice
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "notices", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createNoticeSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const data = parsed.data;

  // Enforce branch scope isolation for non-global roles
  if (
    ctx.roleName !== "SUPER_ADMIN" &&
    ctx.roleName !== "SCHOOL_ADMIN" &&
    ctx.branchId &&
    data.branchId !== ctx.branchId
  ) {
    return apiError("FORBIDDEN", "Cannot create notice for another branch", 403);
  }

  try {
    // Fetch creator's name from database
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    });
    const creatorName = user?.name || "Administrator";

    let publishedAtVal: Date | null = null;
    let isPublishedVal = data.isPublished;

    if (data.isPublished) {
      publishedAtVal = new Date();
    } else if (data.publishedAt) {
      publishedAtVal = new Date(data.publishedAt);
      isPublishedVal = true;
    }

    const notice = await prisma.notice.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: data.branchId || null,
        title: data.title,
        content: data.content,
        targetRoles: JSON.stringify(data.targetRoles),
        isPublished: isPublishedVal,
        publishedAt: publishedAtVal,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdBy: creatorName,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: notice.branchId,
      userId: ctx.userId,
      action: "CREATE",
      module: "notices",
      entityId: notice.id,
      details: { title: notice.title, isPublished: notice.isPublished },
    });

    let parsedRoles: string[] = [];
    try {
      parsedRoles = JSON.parse(notice.targetRoles);
    } catch {
      parsedRoles = [];
    }

    return apiSuccess(
      {
        ...notice,
        targetRoles: parsedRoles,
      },
      undefined,
      201
    );
  } catch (error) {
    console.error("Create notice error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create notice", 500);
  }
}
