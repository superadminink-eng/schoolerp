import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import crypto from "crypto";
import { generateUniqueAdmissionNo, generateUniqueInvoiceNo, generateUniqueReceiptNo } from "@/lib/unique-id";
import { logAction } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admissions/applications/[id]/promote — Promote shortlisted candidate to active student
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "admissions", "registrar_desk");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const {
    sectionId,
    rollNo,
    admissionDate,
    discountPercent,
    amountPaid,
    paymentMethod,
    transactionId,
    installments,
    termType,
  } = body as {
    sectionId: string;
    rollNo?: string;
    admissionDate?: string;
    discountPercent?: number;
    amountPaid?: number;
    paymentMethod?: "CASH" | "ONLINE" | "CHEQUE" | "BANK_TRANSFER" | "UPI";
    transactionId?: string;
    installments?: { templateId: string; amount: number }[];
    termType?: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
  };

  if (!sectionId) {
    return apiError("BAD_REQUEST", "Missing required field: sectionId", 400);
  }

  try {
    // Restrict branch-scoped roles to their home branch
    const branchScope = ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId
      ? { branchId: ctx.branchId }
      : {};

    // 1. Verify application exists and belongs to organization/branch scope
    const application = await prisma.admissionApplication.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        ...branchScope,
      },
      include: {
        documents: true,
      },
    });

    if (!application) {
      return apiError("NOT_FOUND", "Application not found in current scope", 404);
    }

    if (application.status === "ADMITTED") {
      return apiError("CONFLICT", "Candidate has already been admitted", 409);
    }

    // Verify age validation: student must be at least 3 years old on admission date
    const dob = new Date(application.dateOfBirth);
    const admDate = admissionDate ? new Date(admissionDate) : new Date();
    const ageAtAdmission = (admDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (ageAtAdmission < 3.0) {
      return apiError("BAD_REQUEST", "Student must be at least 3 years old on the admission date", 400);
    }

    // 2. Verify section exists and links to the correct class/branch
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        class: {
          id: application.classId,
          branchId: application.branchId,
        },
      },
      include: {
        class: true,
      },
    });

    if (!section) {
      return apiError("NOT_FOUND", "Selected class section not found", 404);
    }

    // 3. Promote candidate in a database transaction
    const student = await prisma.$transaction(async (tx) => {
      // Create student admission number
      const admissionNo = await generateUniqueAdmissionNo(tx, ctx.organizationId);

      // Create official Student record
      const studentRecord = await tx.student.create({
        data: {
          branchId: application.branchId,
          organizationId: ctx.organizationId,
          admissionNo,
          rollNo: rollNo || null,
          firstName: application.firstName,
          lastName: application.lastName,
          dateOfBirth: application.dateOfBirth,
          gender: application.gender,
          bloodGroup: application.bloodGroup,
          photo: application.photo,
          address: application.address,
          pincode: application.pincode,
          previousSchool: application.previousSchool,
          emergencyContact1: application.emergencyContact,
          fatherName: application.fatherName,
          fatherPhone: application.fatherPhone,
          fatherEmail: application.fatherEmail,
          fatherOccupation: application.fatherOccupation,
          motherName: application.motherName,
          motherPhone: application.motherPhone,
          motherEmail: application.motherEmail,
          motherOccupation: application.motherOccupation,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          status: "ACTIVE",
        },
      });

      // Create official Enrollment record
      await tx.studentEnrollment.create({
        data: {
          studentId: studentRecord.id,
          academicYearId: application.academicYearId,
          sectionId,
          rollNo: rollNo || null,
          termType: termType || "FULL_TERM",
        },
      });

      // Calculate and generate invoices if fee structures exist for this class and student's term type
      const feeStructures = await tx.feeStructure.findMany({
        where: { classId: application.classId, termType: termType || "FULL_TERM" },
        include: { feeCategory: { select: { name: true } } },
      });

      if (feeStructures.length > 0) {
        // Compute standard annual fees for each category
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
        const discountPct = new Prisma.Decimal(discountPercent ?? 0);
        const discountMultiplier = new Prisma.Decimal(1).minus(discountPct.div(100));

        // 1. Check if installment templates are setup or provided
        let targetInstallments: { name: string; amount: Prisma.Decimal; dueDate: Date; lateFeeActive: boolean; lateFeeType: string; lateFeeValue: Prisma.Decimal; lateFeePerDay: Prisma.Decimal; lateFeeGrace: number }[] = [];
        
        if (installments && installments.length > 0) {
          // Resolve templates matching the IDs passed in request
          const templateIds = installments.map(i => i.templateId);
          const matchedTemplates = await tx.feeInstallmentTemplate.findMany({
            where: { id: { in: templateIds } },
          });

          targetInstallments = installments.map(inst => {
            const temp = matchedTemplates.find(t => t.id === inst.templateId);
            return {
              name: temp?.name || "Installment",
              amount: new Prisma.Decimal(inst.amount),
              dueDate: temp?.dueDate || new Date(),
              lateFeeActive: temp?.lateFeeActive || false,
              lateFeeType: temp?.lateFeeType || "DAILY",
              lateFeeValue: temp ? new Prisma.Decimal(temp.lateFeeValue) : new Prisma.Decimal(0),
              lateFeePerDay: temp ? new Prisma.Decimal(temp.lateFeePerDay) : new Prisma.Decimal(0),
              lateFeeGrace: temp?.lateFeeGrace || 0,
            };
          });
        } else {
          // Query standard class templates from DB
          const classTemplates = await tx.feeInstallmentTemplate.findMany({
            where: {
              classId: application.classId,
              academicYearId: application.academicYearId,
              termType: termType || "FULL_TERM",
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
        }

        const createdInvoices = [];

        if (targetInstallments.length > 0) {
          // Generate proportional invoices based on installment templates
          const totalTemplateAmount = targetInstallments.reduce((sum, inst) => sum.plus(inst.amount), new Prisma.Decimal(0));

          for (const inst of targetInstallments) {
            const invoiceNo = await generateUniqueInvoiceNo(tx, ctx.organizationId);
            const installmentDiscountedTotal = inst.amount.mul(discountMultiplier);

            // Make sure due dates in the past are bumped to today/admission date if desired
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
          // Fallback to single consolidated annual invoice
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

        // Apply dynamic payment rollover
        let remainingPayment = amountPaid ?? 0;
        
        if (remainingPayment > 0 && paymentMethod) {
          // Sort created invoices by dueDate ascending
          createdInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

          for (const inv of createdInvoices) {
            if (remainingPayment <= 0) break;

            const invTotal = Number(inv.totalAmount);
            const paymentToApply = Math.min(remainingPayment, invTotal);
            const newPaidAmount = paymentToApply;
            const newStatus = newPaidAmount >= invTotal ? "PAID" : "PARTIAL";

            const receiptNo = await generateUniqueReceiptNo(tx, ctx.organizationId);

            await tx.feePayment.create({
              data: {
                invoiceId: inv.id,
                studentId: studentRecord.id,
                organizationId: ctx.organizationId,
                amount: paymentToApply,
                method: paymentMethod,
                transactionId: transactionId || null,
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

            remainingPayment -= paymentToApply;
          }
        }
      }

      // Update application status to ADMITTED
      await tx.admissionApplication.update({
        where: { id },
        data: { status: "ADMITTED" },
      });

      return studentRecord;
    }, { timeout: 30000 });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: student.branchId,
      userId: ctx.userId,
      action: "CREATE",
      module: "STUDENTS",
      entityId: student.id,
      details: { admissionNo: student.admissionNo, name: `${student.firstName} ${student.lastName}`, promotedFrom: id }
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: student.branchId,
      userId: ctx.userId,
      action: "PROMOTE",
      module: "ADMISSIONS",
      entityId: id,
      details: { applicationNo: application.applicationNo, studentId: student.id }
    });

    return apiSuccess(student, undefined, 201);
  } catch (error) {
    console.error("Promote candidate error:", error);
    return apiError("INTERNAL_ERROR", "Failed to promote candidate to student", 500);
  }
}
