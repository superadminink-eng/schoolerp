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
import { saveUploadedImage, UploadError } from "@/lib/upload";
import crypto from "crypto";
import { generateUniqueAdmissionNo, generateUniqueInvoiceNo, generateUniqueReceiptNo } from "@/lib/unique-id";
import { logAction } from "@/lib/audit";

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

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };

  if (ctx.branchId && branchId !== "__all__") {
    where.branchId = ctx.branchId;
  } else if (branchId && branchId !== "ALL" && branchId !== "__all__") {
    where.branchId = branchId;
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { admissionNo: { contains: search } },
    ];
  }

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
            select: { amount: true },
          },
          invoices: {
            where: { status: { not: "CANCELLED" } },
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

    return apiSuccess(students, { page, limit, total });
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
    // Verify branch belongs to this organization
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!branch) {
      return apiError("NOT_FOUND", "Branch not found", 404);
    }

    // Verify section exists and get its class + academic year (if provided)
    let section: { id: string; classId: string; class: { branchId: string; academicYearId: string } } | null = null;
    if (data.sectionId) {
      section = await prisma.section.findFirst({
        where: { id: data.sectionId },
        include: {
          class: {
            include: { academicYear: true },
          },
        },
      });
      if (!section || section.class.branchId !== data.branchId) {
        return apiError("NOT_FOUND", "Section not found for this branch", 404);
      }
    }

    // Verify class exists and belongs to this branch/organization (if provided)
    if (data.classId) {
      const cls = await prisma.class.findFirst({
        where: { id: data.classId, branchId: data.branchId, status: "ACTIVE" },
      });
      if (!cls) {
        return apiError("NOT_FOUND", "Class not found for this branch", 404);
      }
    }
    // Auto-generate admissionNo
    const admissionNo = await generateUniqueAdmissionNo(prisma, ctx.organizationId);

    // Handle photo upload
    let photoPath: string | null = null;
    const photoFile = formData.get("photo");
    if (photoFile instanceof File && photoFile.size > 0) {
      try {
        const result = await saveUploadedImage(photoFile, "uploads/student-photos", admissionNo, "photo");
        photoPath = result.filePath;
      } catch (error) {
        if (error instanceof UploadError) {
          return apiError("VALIDATION_ERROR", `Photo: ${error.message}`, 422);
        }
        throw error;
      }
    }

    // Handle ID document upload
    let idDocumentPath: string | null = null;
    const idDocFile = formData.get("idDocument");
    if (idDocFile instanceof File && idDocFile.size > 0) {
      try {
        const result = await saveUploadedImage(idDocFile, "uploads/student-documents", admissionNo);
        idDocumentPath = result.filePath;
      } catch (error) {
        if (error instanceof UploadError) {
          return apiError("VALIDATION_ERROR", `ID Document: ${error.message}`, 422);
        }
        throw error;
      }
    }

    // Create student + enrollment in a transaction
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          branchId: data.branchId,
          organizationId: ctx.organizationId,
          admissionNo,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          bloodGroup: data.bloodGroup || null,
          photo: photoPath,
          address: data.address,
          pincode: data.pincode,
          previousSchool: data.previousSchool || null,
          emergencyContact1: data.emergencyContact1,
          emergencyContact2: data.emergencyContact2 || null,
          idType: data.idType || null,
          idNumber: data.idNumber || null,
          idDocument: idDocumentPath,
          guardianName: data.guardianName || null,
          fatherName: data.fatherName || null,
          fatherPhone: data.fatherPhone || null,
          fatherEmail: data.fatherEmail || null,
          fatherOccupation: data.fatherOccupation || null,
          motherName: data.motherName || null,
          motherPhone: data.motherPhone || null,
          motherEmail: data.motherEmail || null,
          motherOccupation: data.motherOccupation || null,
          admissionDate: data.admissionDate ? new Date(data.admissionDate) : new Date(),
          house: data.house || null,
          category: data.category,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNo: true,
          gender: true,
          status: true,
          admissionDate: true,
          branch: { select: { id: true, name: true } },
        },
      });

      // Create enrollment for current academic year (if division was selected)
      if (section && data.sectionId) {
        await tx.studentEnrollment.create({
          data: {
            studentId: created.id,
            academicYearId: section.class.academicYearId,
            sectionId: data.sectionId,
          },
        });
      }

      // Create invoice + payment if fees exist for this class
      if (data.classId) {
        const feeStructures = await tx.feeStructure.findMany({
          where: { classId: data.classId },
          include: { feeCategory: { select: { name: true } } },
        });

        if (feeStructures.length > 0) {
          // Compute annual amount per fee structure
          const feeItems = feeStructures.map((fs) => {
            const base = new Prisma.Decimal(fs.amount);
            let annual: Prisma.Decimal;
            switch (fs.frequency) {
              case "MONTHLY":
                annual = base.mul(12);
                break;
              case "QUARTERLY":
                annual = base.mul(4);
                break;
              case "SEMI_ANNUAL":
                annual = base.mul(2);
                break;
              default:
                annual = base;
            }
            return { feeStructureId: fs.id, name: fs.feeCategory.name, annual };
          });

          const annualTotal = feeItems.reduce((s, f) => s.plus(f.annual), new Prisma.Decimal(0));
          const discountPct = new Prisma.Decimal(data.discountPercent ?? 0);
          const discountedTotal = annualTotal.mul(new Prisma.Decimal(1).minus(discountPct.div(100)));

          const amountPaid = Prisma.Decimal.min(new Prisma.Decimal(data.amountPaid ?? 0), discountedTotal);

          // Validate amountPaid doesn't exceed discounted total
          if (new Prisma.Decimal(data.amountPaid ?? 0).gt(discountedTotal)) {
            throw new Error("AMOUNT_EXCEEDS_TOTAL");
          }

          let status: "PENDING" | "PARTIAL" | "PAID" = "PENDING";
          if (amountPaid.gt(0) && amountPaid.gte(discountedTotal)) {
            status = "PAID";
          } else if (amountPaid.gt(0)) {
            status = "PARTIAL";
          }

          const invoiceNo = await generateUniqueInvoiceNo(tx, ctx.organizationId);
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);

          const invoice = await tx.invoice.create({
            data: {
              studentId: created.id,
              organizationId: ctx.organizationId,
              number: invoiceNo,
              year: new Date().getFullYear(),
              totalAmount: discountedTotal,
              paidAmount: amountPaid,
              status,
              dueDate,
              items: {
                create: feeItems.map((fi) => {
                  const itemDiscounted = fi.annual.mul(new Prisma.Decimal(1).minus(discountPct.div(100)));
                  return {
                    feeStructureId: fi.feeStructureId,
                    amount: itemDiscounted,
                    description: fi.name,
                  };
                }),
              },
            },
          });

          // Create fee payment record if amount was paid
          const pm = data.paymentMethod;
          if (amountPaid.gt(0) && pm) {
            const receiptNo = await generateUniqueReceiptNo(tx, ctx.organizationId);
            await tx.feePayment.create({
              data: {
                invoiceId: invoice.id,
                studentId: created.id,
                organizationId: ctx.organizationId,
                amount: amountPaid,
                method: pm,
                transactionId: data.transactionId || null,
                receiptNo,
              },
            });
          }
        }
      }

      return created;
    }, { timeout: 30000 });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: student.branch.id,
      userId: ctx.userId,
      action: "CREATE",
      module: "students",
      entityId: student.id,
      details: { admissionNo: student.admissionNo, name: `${student.firstName} ${student.lastName}` },
    });

    return apiSuccess(student, undefined, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "AMOUNT_EXCEEDS_TOTAL") {
      return apiError("VALIDATION_ERROR", "Amount paid cannot exceed the discounted total", 422);
    }
    console.error("Create student error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create student", 500);
  }
}
