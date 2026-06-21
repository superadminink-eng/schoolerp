import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createStudentSchema } from "@/lib/validations/student";
import { UploadError } from "@/lib/upload";
import { StudentService } from "@/services/student-service";
import { buildTenantWhere, buildSearchWhere } from "@/lib/query-helpers";

/**
 * GET /api/v1/students — list students with pagination, search, and filters
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "students", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const branchId = url.searchParams.get("branchId");

  const where: Record<string, any> = {
    ...(await buildTenantWhere(ctx as any, branchId)),
    ...buildSearchWhere(search, ["firstName", "lastName", "admissionNo"]),
  };

  const classId = url.searchParams.get("classId");
  const sectionId = url.searchParams.get("sectionId");
  if (sectionId) {
    where.enrollments = {
      some: { sectionId },
    };
  } else if (classId) {
    where.enrollments = {
      some: { section: { classId } },
    };
  }

  const status = url.searchParams.get("status");
  if (status && status !== "ALL") {
    where.status = status;
  }

  const house = url.searchParams.get("house");
  if (house && house !== "ALL") {
    where.house = house;
  }

  const category = url.searchParams.get("category");
  if (category && category !== "ALL") {
    where.category = category;
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNo: true,
          gender: true,
          status: true,
          category: true,
          house: true,
          dateOfBirth: true,
          admissionDate: true,
          fatherPhone: true,
          motherPhone: true,
          emergencyContact1: true,
          branch: { select: { id: true, name: true } },
          enrollments: {
            take: 1,
            orderBy: { enrolledAt: "desc" },
            select: {
              rollNo: true,
              section: {
                select: {
                  id: true,
                  name: true,
                  class: { select: { id: true, name: true } },
                },
              },
            },
          },
          feePayments: {
            where: { deletedAt: null },
            select: { amount: true },
          },
          invoices: {
            where: { status: { not: "CANCELLED" }, deletedAt: null },
            select: { totalAmount: true, paidAmount: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    // Fetch invoice totals for these students to compute pending fees
    const studentIds = rows.map((s) => s.id);
    const invoiceTotals =
      studentIds.length > 0
        ? await prisma.invoice.groupBy({
            by: ["studentId"],
            where: {
              studentId: { in: studentIds },
              status: { not: "CANCELLED" },
              deletedAt: null,
            },
            _sum: { totalAmount: true, paidAmount: true },
          })
        : [];

    const invoiceMap = new Map(
      invoiceTotals.map((row) => [
        row.studentId,
        {
          totalAmount: new Prisma.Decimal(row._sum.totalAmount ?? 0),
          paidAmount: new Prisma.Decimal(row._sum.paidAmount ?? 0),
        },
      ])
    );

    const students = rows.map((s) => {
      const inv = invoiceMap.get(s.id);
      const totalPaid = s.feePayments.reduce(
        (sum, fp) => sum.plus(new Prisma.Decimal(fp.amount)),
        new Prisma.Decimal(0)
      );
      const invTotal = inv?.totalAmount ?? new Prisma.Decimal(0);
      const invPaid = inv?.paidAmount ?? new Prisma.Decimal(0);
      const pendingFees = invTotal.minus(invPaid);
      const { feePayments: _, ...rest } = s;
      return {
        ...rest,
        totalFees: invTotal.toNumber(),
        totalFeesPaid: totalPaid.toNumber(),
        pendingFees: pendingFees.toNumber(),
      };
    });

    const [activeCount, rteCount, inactiveCount] = await Promise.all([
      prisma.student.count({ where: { ...where, status: "ACTIVE" } }),
      prisma.student.count({ where: { ...where, category: "RTE" } }),
      prisma.student.count({ where: { ...where, status: { in: ["DROPPED", "SUSPENDED", "TRANSFERRED"] } } }),
    ]);

    return apiSuccess(students, {
      page,
      limit,
      total,
      stats: {
        active: activeCount,
        rte: rteCount,
        inactive: inactiveCount,
      }
    });
  } catch (error) {
    console.error("List students error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list students", 500);
  }
}

/**
 * POST /api/v1/students — create a new student (accepts FormData for file uploads)
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "students", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let formData: any;
  try {
    formData = await req.formData();
  } catch {
    return apiError("BAD_REQUEST", "Invalid form data", 400);
  }

  // Extract text fields from FormData
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
    }
  }

  const parsed = createStudentSchema.safeParse(fields);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const data = parsed.data;

  // Enforce branch isolation for all branch-level roles
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && data.branchId !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot create student in another branch", 403);
  }

  try {
    const photoFile = formData.get("photo") as File | null;
    const idDocumentFile = formData.get("idDocument") as File | null;

    const studentInput = {
      ...data,
      discountPercent: fields.discountPercent,
      amountPaid: fields.amountPaid,
      paymentMethod: fields.paymentMethod,
      transactionId: fields.transactionId,
    };

    const student = await StudentService.createStudent(
      studentInput as any,
      { photo: photoFile, idDocument: idDocumentFile },
      ctx
    );

    return apiSuccess(student, undefined, 201);
  } catch (error: any) {
    if (error.message === "BRANCH_NOT_FOUND") {
      return apiError("NOT_FOUND", "Branch not found", 404);
    }
    if (error.message === "SECTION_NOT_FOUND") {
      return apiError("NOT_FOUND", "Section not found for this branch", 404);
    }
    if (error.message === "CLASS_NOT_FOUND") {
      return apiError("NOT_FOUND", "Class not found for this branch", 404);
    }
    if (error.message === "AMOUNT_EXCEEDS_TOTAL") {
      return apiError("VALIDATION_ERROR", "Amount paid cannot exceed the discounted total", 422);
    }
    if (error instanceof UploadError) {
      return apiError("VALIDATION_ERROR", error.message, 422);
    }
    console.error("Create student error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create student", 500);
  }
}

