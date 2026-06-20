import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext, hasPermission } from "@/lib/rbac";
import { buildTenantWhere, buildSearchWhere } from "@/lib/query-helpers";
import { createApplicationSchema } from "@/lib/validations/admission";
import crypto from "crypto";
import { generateUniqueApplicationNo } from "@/lib/unique-id";
import { logAction } from "@/lib/audit";

/**
 * GET /api/v1/admissions/applications — List and filter applications
 */
export async function GET(req: NextRequest) {
  const ctx = getTenantContext(req);
  const isSuperOrSchoolAdmin = ctx.roleName === "SUPER_ADMIN" || ctx.roleName === "SCHOOL_ADMIN";
  let allowed = isSuperOrSchoolAdmin;
  if (!allowed) {
    const [hasVerify, hasExam, hasRegistrar] = await Promise.all([
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "document_verification"),
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "entrance_exam"),
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "registrar_desk"),
    ]);
    allowed = hasVerify || hasExam || hasRegistrar;
  }

  if (!allowed) {
    return apiError("FORBIDDEN", "Insufficient permissions", 403);
  }
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const branchId = url.searchParams.get("branchId");
  const status = url.searchParams.get("status");
  const classId = url.searchParams.get("classId");

  const where: Record<string, any> = {
    ...(await buildTenantWhere(ctx as any, branchId)),
    ...(status && { status }),
    ...(classId && { classId }),
    ...buildSearchWhere(search, ["firstName", "lastName", "applicationNo", "fatherName", "motherName"]),
  };

  try {
    const [applications, total] = await Promise.all([
      prisma.admissionApplication.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          documents: true,
          examResult: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.admissionApplication.count({ where }),
    ]);

    return apiSuccess(applications, { page, limit, total });
  } catch (error) {
    console.error("List applications error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list applications", 500);
  }
}

/**
 * POST /api/v1/admissions/applications — Create/Submit a new application
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "admissions", "document_verification");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const data = parsed.data;

  // Restrict branch-scoped roles to their home branch
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && data.branchId !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot create application in another branch", 403);
  }

  try {
    // Validate branch belongs to organization
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!branch) {
      return apiError("NOT_FOUND", "Branch not found or inactive", 404);
    }

    // Validate class belongs to branch
    const cls = await prisma.class.findFirst({
      where: { id: data.classId, branchId: data.branchId, status: "ACTIVE" },
    });
    if (!cls) {
      return apiError("NOT_FOUND", "Class not found in target branch", 404);
    }

    // Validate academic year belongs to organization
    const ay = await prisma.academicYear.findFirst({
      where: { id: data.academicYearId, organizationId: ctx.organizationId },
    });
    if (!ay) {
      return apiError("NOT_FOUND", "Academic year not found", 404);
    }

    const application = await prisma.$transaction(async (tx) => {
      const applicationNo = await generateUniqueApplicationNo(tx, ctx.organizationId);

      const created = await tx.admissionApplication.create({
        data: {
          inquiryId: data.inquiryId || null,
          organizationId: ctx.organizationId,
          branchId: data.branchId,
          academicYearId: data.academicYearId,
          classId: data.classId,
          applicationNo,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          bloodGroup: data.bloodGroup || null,
          address: data.address,
          pincode: data.pincode,
          previousSchool: data.previousSchool || null,
          emergencyContact: data.emergencyContact,
          fatherName: data.fatherName || null,
          fatherPhone: data.fatherPhone || null,
          fatherEmail: data.fatherEmail || null,
          fatherOccupation: data.fatherOccupation || null,
          motherName: data.motherName || null,
          motherPhone: data.motherPhone || null,
          motherEmail: data.motherEmail || null,
          motherOccupation: data.motherOccupation || null,
          status: "SUBMITTED",
        },
      });

      // If inquiryId is provided, mark inquiry status as APPLIED
      if (data.inquiryId) {
        await tx.admissionInquiry.update({
          where: { id: data.inquiryId },
          data: { status: "APPLIED" },
        });
      }

      return created;
    }, { timeout: 15000 });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: application.branchId,
      userId: ctx.userId,
      action: "CREATE",
      module: "ADMISSIONS",
      entityId: application.id,
      details: { applicationNo: application.applicationNo, name: `${application.firstName} ${application.lastName}` }
    });

    return apiSuccess(application, undefined, 201);
  } catch (error) {
    console.error("Create application error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create application", 500);
  }
}
