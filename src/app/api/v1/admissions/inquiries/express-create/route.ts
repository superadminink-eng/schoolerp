import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { expressCreateSchema } from "@/lib/validations/express-admission";
import {
  generateUniqueAdmissionNo,
  generateUniqueInvoiceNo,
  generateUniqueReceiptNo,
  generateUniqueApplicationNo,
} from "@/lib/unique-id";
import { logAction } from "@/lib/audit";

function splitFullName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Student" };
  }
  const lastName = parts.pop() || "";
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

/**
 * POST /api/v1/admissions/inquiries/express-create
 * Unified endpoint for logging a new Inquiry and immediately converting it to an active Student.
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "admissions", "registrar_desk");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = expressCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", "Validation failed", 400);
  }

  const data = parsed.data;
  const { bypassAgeLimit } = body as { bypassAgeLimit?: boolean };

  // Enforce branch isolation for all branch-level roles
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && data.branchId !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot create student in another branch", 403);
  }

  try {
    // Verify branch belongs to organization
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!branch) {
      return apiError("NOT_FOUND", "Branch not found", 404);
    }

    // Age validation (bypassable with flag)
    const dob = new Date(data.dateOfBirth);
    const admDate = data.admissionDate ? new Date(data.admissionDate) : new Date();
    const ageAtAdmission = (admDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (ageAtAdmission < 3.0 && !bypassAgeLimit) {
      return apiError("BAD_REQUEST", "Student must be at least 3 years old on the admission date", 400);
    }

    // Verify Section
    const section = await prisma.section.findFirst({
      where: {
        id: data.sectionId,
        class: {
          id: data.classAppliedId,
          branchId: data.branchId,
        },
      },
      include: {
        class: true,
      },
    });

    if (!section) {
      return apiError("NOT_FOUND", "Selected class section not found", 404);
    }

    const { firstName, lastName } = splitFullName(data.studentName);

    // Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Inquiry
      const inquiry = await tx.admissionInquiry.create({
        data: {
          organizationId: ctx.organizationId,
          branchId: data.branchId,
          academicYearId: data.academicYearId,
          studentName: data.studentName,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          classAppliedId: data.classAppliedId,
          parentName: data.parentName,
          parentPhone: data.parentPhone,
          parentEmail: data.parentEmail,
          source: data.source || "WALK_IN",
          status: "APPLIED",
          notes: data.notes || null,
        },
      });

      // 2. Create Application
      const applicationNo = await generateUniqueApplicationNo(tx, ctx.organizationId);
      await tx.admissionApplication.create({
        data: {
          inquiryId: inquiry.id,
          organizationId: ctx.organizationId,
          branchId: data.branchId,
          academicYearId: data.academicYearId,
          classId: data.classAppliedId,
          applicationNo,
          firstName,
          lastName,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          address: "N/A",
          pincode: "000000",
          emergencyContact: data.parentPhone,
          fatherName: data.parentName,
          fatherPhone: data.parentPhone,
          fatherEmail: data.parentEmail,
          status: "ADMITTED",
          applicationFeePaid: true,
        },
      });

      // 3. Create Student profile
      const admissionNo = await generateUniqueAdmissionNo(tx, ctx.organizationId);
      const studentRecord = await tx.student.create({
        data: {
          branchId: data.branchId,
          organizationId: ctx.organizationId,
          admissionNo,
          rollNo: data.rollNo || null,
          firstName,
          lastName,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          address: "N/A",
          pincode: "000000",
          emergencyContact1: data.parentPhone,
          fatherName: data.parentName,
          fatherPhone: data.parentPhone,
          fatherEmail: data.parentEmail,
          admissionDate: data.admissionDate ? new Date(data.admissionDate) : new Date(),
          status: "ACTIVE",
        },
      });

      // 4. Create StudentEnrollment
      await tx.studentEnrollment.create({
        data: {
          studentId: studentRecord.id,
          academicYearId: data.academicYearId,
          sectionId: data.sectionId,
          rollNo: data.rollNo || null,
          termType: data.termType || "FULL_TERM",
        },
      });

      // 5. Billing generation (copied from promote endpoint)
      const feeStructures = await tx.feeStructure.findMany({
        where: { classId: data.classAppliedId, termType: data.termType || "FULL_TERM" },
        include: { feeCategory: { select: { name: true } } },
      });

      if (feeStructures.length > 0) {
        const feeCategoriesAnnual = feeStructures.map((fs) => {
          const base = new Prisma.Decimal(fs.amount);
          let annual = base;
          switch (fs.frequency) {
            case "MONTHLY": annual = base.mul(12); break;
            case "QUARTERLY": annual = base.mul(4); break;
            case "SEMI_ANNUAL": annual = base.mul(2); break;
            default: annual = base;
          }
          return { feeStructureId: fs.id, name: fs.feeCategory.name, annual };
        });

        const annualTotal = feeCategoriesAnnual.reduce((s, f) => s.plus(f.annual), new Prisma.Decimal(0));
        const discountPct = new Prisma.Decimal(data.discountPercent ?? 0);
        const discountMultiplier = new Prisma.Decimal(1).minus(discountPct.div(100));

        let targetInstallments: { name: string; amount: Prisma.Decimal; dueDate: Date; lateFeeActive: boolean; lateFeeType: string; lateFeeValue: Prisma.Decimal; lateFeePerDay: Prisma.Decimal; lateFeeGrace: number }[] = [];
        
        const classTemplates = await tx.feeInstallmentTemplate.findMany({
          where: {
            classId: data.classAppliedId,
            academicYearId: data.academicYearId,
            termType: data.termType || "FULL_TERM",
          },
          orderBy: { dueDate: "asc" },
        });

        if (classTemplates.length > 0) {
          targetInstallments = classTemplates.map(t => ({
            name: t.name,
            amount: new Prisma.Decimal(t.amount),
            dueDate: t.dueDate,
            lateFeeActive: t.lateFeeActive,
            lateFeeType: t.lateFeeType,
            lateFeeValue: new Prisma.Decimal(t.lateFeeValue),
            lateFeePerDay: new Prisma.Decimal(t.lateFeePerDay),
            lateFeeGrace: t.lateFeeGrace,
          }));
        }

        const createdInvoices = [];

        if (targetInstallments.length > 0) {
          const totalTemplateAmount = targetInstallments.reduce((sum, inst) => sum.plus(inst.amount), new Prisma.Decimal(0));

          for (const inst of targetInstallments) {
            const invoiceNo = await generateUniqueInvoiceNo(tx, ctx.organizationId);
            const installmentDiscountedTotal = inst.amount.mul(discountMultiplier);

            let finalDueDate = new Date(inst.dueDate);
            const today = new Date();
            if (finalDueDate < today) {
              finalDueDate = today;
            }

            const invoice = await tx.invoice.create({
              data: {
                studentId: studentRecord.id,
                organizationId: ctx.organizationId,
                number: invoiceNo,
                year: new Date().getFullYear(),
                totalAmount: installmentDiscountedTotal,
                paidAmount: 0,
                status: "PENDING",
                dueDate: finalDueDate,
                lateFeeActive: inst.lateFeeActive,
                lateFeeType: (inst.lateFeeType || "DAILY") as any,
                lateFeeValue: inst.lateFeeValue,
                lateFeePerDay: inst.lateFeePerDay,
                lateFeeGrace: inst.lateFeeGrace,
                items: {
                  create: feeCategoriesAnnual.map((fi) => {
                    const proportionalAmount = totalTemplateAmount.gt(0) 
                      ? fi.annual.mul(inst.amount.div(totalTemplateAmount)).mul(discountMultiplier) 
                      : new Prisma.Decimal(0);
                    return {
                      feeStructureId: fi.feeStructureId,
                      amount: proportionalAmount,
                      description: `${fi.name} - ${inst.name}`,
                    };
                  }),
                },
              },
            });

            createdInvoices.push(invoice);
          }
        } else {
          const invoiceNo = await generateUniqueInvoiceNo(tx, ctx.organizationId);
          const discountedTotal = annualTotal.mul(discountMultiplier);
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);

          const invoice = await tx.invoice.create({
            data: {
              studentId: studentRecord.id,
              organizationId: ctx.organizationId,
              number: invoiceNo,
              year: new Date().getFullYear(),
              totalAmount: discountedTotal,
              paidAmount: 0,
              status: "PENDING",
              dueDate,
              items: {
                create: feeCategoriesAnnual.map((fi) => ({
                  feeStructureId: fi.feeStructureId,
                  amount: fi.annual.mul(discountMultiplier),
                  description: fi.name,
                })),
              },
            },
          });

          createdInvoices.push(invoice);
        }

        // Apply payment rollover
        let remainingPayment = new Prisma.Decimal(data.amountPaid ?? 0);
        
        if (remainingPayment.gt(0) && data.paymentMethod) {
          createdInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

          for (const inv of createdInvoices) {
            if (remainingPayment.lte(0)) break;

            const invTotal = new Prisma.Decimal(inv.totalAmount);
            const paymentToApply = remainingPayment.lt(invTotal) ? remainingPayment : invTotal;
            const newPaidAmount = paymentToApply;
            const newStatus = newPaidAmount.gte(invTotal) ? "PAID" : "PARTIAL";

            const receiptNo = await generateUniqueReceiptNo(tx, ctx.organizationId);

            await tx.feePayment.create({
              data: {
                invoiceId: inv.id,
                studentId: studentRecord.id,
                organizationId: ctx.organizationId,
                amount: paymentToApply,
                method: data.paymentMethod,
                transactionId: data.transactionId || null,
                receiptNo,
                paidAt: new Date(),
              },
            });

            await tx.invoice.update({
              where: { id: inv.id },
              data: {
                paidAmount: newPaidAmount,
                status: newStatus,
              },
            });

            remainingPayment = remainingPayment.minus(paymentToApply);
          }
        }
      }

      return { student: studentRecord, inquiry };
    }, { timeout: 30000 });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: result.student.branchId,
      userId: ctx.userId,
      action: "CREATE",
      module: "INQUIRIES",
      entityId: result.inquiry.id,
      details: { name: result.inquiry.studentName }
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: result.student.branchId,
      userId: ctx.userId,
      action: "CREATE",
      module: "STUDENTS",
      entityId: result.student.id,
      details: { admissionNo: result.student.admissionNo, name: `${result.student.firstName} ${result.student.lastName}`, expressCreatedFrom: result.inquiry.id }
    });

    return apiSuccess(result.student, undefined, 201);
  } catch (error) {
    console.error("Express create candidate error:", error);
    return apiError("INTERNAL_ERROR", "Failed to express create candidate", 500);
  }
}
