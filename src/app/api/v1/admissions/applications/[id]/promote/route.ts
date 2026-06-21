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

    // Promote candidate in a database transaction (all validation inside to prevent TOCTOU race)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify application exists and belongs to organization/branch scope
      const application = await tx.admissionApplication.findFirst({
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
        throw new Error("APPLICATION_NOT_FOUND: Application not found in current scope");
      }

      if (application.status === "ADMITTED") {
        throw new Error("ALREADY_ADMITTED: Candidate has already been admitted");
      }

      // Verify age validation: student must be at least 3 years old on admission date
      const dob = new Date(application.dateOfBirth);
      const admDate = admissionDate ? new Date(admissionDate) : new Date();
      const ageAtAdmission = (admDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageAtAdmission < 3.0) {
        throw new Error("AGE_VALIDATION: Student must be at least 3 years old on the admission date");
      }

      // 2. Verify section exists and links to the correct class/branch
      const section = await tx.section.findFirst({
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
        throw new Error("SECTION_NOT_FOUND: Selected class section not found");
      }

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
        where: {
          classId: application.classId,
          academicYearId: application.academicYearId,
          termType: termType || "FULL_TERM",
        },
        include: { feeCategory: { select: { name: true } } },
      });

      if (feeStructures.length === 0) {
        throw new Error("FEE_STRUCTURE_UNCONFIGURED: No active fee structures found for this class.");
      }

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

      const totalDiscountedFee = annualTotal.mul(discountMultiplier).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
      const amountPaidDecimal = new Prisma.Decimal(amountPaid ?? 0);

      if (amountPaidDecimal.gt(0) && !paymentMethod) {
        throw new Error("MISSING_PAYMENT_METHOD: Upfront payment requires a payment method to be selected.");
      }

      if (amountPaidDecimal.gt(totalDiscountedFee)) {
        throw new Error(`OVERPAYMENT: Upfront payment of ₹${amountPaidDecimal.toFixed(2)} exceeds total discounted fee of ₹${totalDiscountedFee.toFixed(2)}.`);
      }

      // 1. Check if installment templates are setup or provided
      let targetInstallments: { name: string; amount: Prisma.Decimal; dueDate: Date; lateFeeActive: boolean; lateFeeType: string; lateFeeValue: Prisma.Decimal; lateFeePerDay: Prisma.Decimal; lateFeeGrace: number }[] = [];
      
      if (installments) {
        if (installments.length === 0) {
          throw new Error("INSTALLMENT_AMOUNT_MISMATCH: At least one fee installment must be selected.");
        }
        if (installments.some(inst => inst.amount <= 0)) {
          throw new Error("INSTALLMENT_AMOUNT_MISMATCH: All installment amounts must be greater than zero.");
        }
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

        const totalCustomAmount = targetInstallments.reduce((sum, inst) => sum.plus(inst.amount), new Prisma.Decimal(0));
        if (totalCustomAmount.gt(totalDiscountedFee)) {
          throw new Error(`INSTALLMENT_AMOUNT_MISMATCH: The sum of custom installments (₹${totalCustomAmount}) exceeds the total discounted fee structures (₹${totalDiscountedFee}).`);
        }
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
          const totalTemplateAmount = classTemplates.reduce((sum, inst) => sum.plus(new Prisma.Decimal(inst.amount)), new Prisma.Decimal(0));
          
          if (!totalTemplateAmount.equals(annualTotal)) {
            throw new Error(`INSTALLMENT_AMOUNT_MISMATCH: The sum of installment templates (₹${totalTemplateAmount}) does not match the total fee structures (₹${annualTotal}).`);
          }

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
        } else {
          // Fallback: Copy late fee parameters from another template of the same class
          const fallbackTemplate = await tx.feeInstallmentTemplate.findFirst({
            where: { classId: application.classId },
          });

          targetInstallments = [{
            name: "Consolidated Annual Fee",
            amount: annualTotal,
            dueDate: new Date(),
            lateFeeActive: fallbackTemplate?.lateFeeActive ?? false,
            lateFeeType: fallbackTemplate?.lateFeeType ?? "DAILY",
            lateFeeValue: new Prisma.Decimal(fallbackTemplate?.lateFeeValue ?? 0),
            lateFeePerDay: new Prisma.Decimal(fallbackTemplate?.lateFeePerDay ?? 0),
            lateFeeGrace: fallbackTemplate?.lateFeeGrace ?? 0,
          }];
        }
      }

      const createdInvoices = [];

      for (const inst of targetInstallments) {
        const invoiceNo = await generateUniqueInvoiceNo(tx, ctx.organizationId);
        const installmentDiscountedTotal = inst.amount.mul(discountMultiplier);

        // Make sure due dates in the past are bumped to today/admission date if desired
        let finalDueDate = new Date(inst.dueDate);
        const today = new Date();
        if (finalDueDate < today) {
          finalDueDate = today;
        }

        // Proportional Allocation with Remainder Balancing
        const itemData = [];
        let allocatedSum = new Prisma.Decimal(0);

        for (let i = 0; i < feeCategoriesAnnual.length; i++) {
          const fi = feeCategoriesAnnual[i];
          let proportionalAmount;

          if (i === feeCategoriesAnnual.length - 1) {
            proportionalAmount = installmentDiscountedTotal.minus(allocatedSum);
          } else {
            proportionalAmount = installmentDiscountedTotal
              .mul(fi.annual)
              .div(annualTotal)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            allocatedSum = allocatedSum.plus(proportionalAmount);
          }

          itemData.push({
            feeStructureId: fi.feeStructureId,
            amount: proportionalAmount,
            description: `${fi.name} - ${inst.name}`,
          });
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
            lateFeeType: inst.lateFeeType as any,
            lateFeeValue: inst.lateFeeValue,
            lateFeePerDay: inst.lateFeePerDay,
            lateFeeGrace: inst.lateFeeGrace,
            items: {
              create: itemData,
            },
          },
        });

        createdInvoices.push(invoice);
      }

      // Apply dynamic payment rollover
      let remainingPayment = new Prisma.Decimal(amountPaid ?? 0);
      
      if (remainingPayment.gt(0) && paymentMethod) {
        // Sort created invoices by dueDate ascending
        createdInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        const unifiedTransactionId = transactionId || `TXN-ADM-${Date.now()}-${crypto.randomBytes ? crypto.randomBytes(4).toString("hex") : Math.random().toString(36).substring(7)}`;

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
              method: paymentMethod,
              transactionId: unifiedTransactionId,
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

      // Atomic status update — prevents race if another request admitted concurrently
      const statusUpdate = await tx.admissionApplication.updateMany({
        where: { id, status: { not: "ADMITTED" } },
        data: { status: "ADMITTED" },
      });
      if (statusUpdate.count === 0) {
        throw new Error("ALREADY_ADMITTED: Candidate has already been admitted");
      }

      return { student: studentRecord, applicationNo: application.applicationNo };
    }, { timeout: 30000 });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: result.student.branchId,
      userId: ctx.userId,
      action: "CREATE",
      module: "STUDENTS",
      entityId: result.student.id,
      details: { admissionNo: result.student.admissionNo, name: `${result.student.firstName} ${result.student.lastName}`, promotedFrom: id }
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: result.student.branchId,
      userId: ctx.userId,
      action: "PROMOTE",
      module: "ADMISSIONS",
      entityId: id,
      details: { applicationNo: result.applicationNo, studentId: result.student.id }
    });

    return apiSuccess(result.student, undefined, 201);
  } catch (error: any) {
    console.error("Promote candidate error:", error);
    const msg = error?.message || "";
    if (msg.startsWith("APPLICATION_NOT_FOUND:") || msg.startsWith("SECTION_NOT_FOUND:")) {
      return apiError("NOT_FOUND", msg.split(": ")[1], 404);
    }
    if (msg.startsWith("ALREADY_ADMITTED:")) {
      return apiError("CONFLICT", msg.split(": ")[1], 409);
    }
    if (
      msg.startsWith("AGE_VALIDATION:") ||
      msg.startsWith("FEE_STRUCTURE_UNCONFIGURED:") ||
      msg.startsWith("INSTALLMENT_AMOUNT_MISMATCH:") ||
      msg.startsWith("OVERPAYMENT:") ||
      msg.startsWith("MISSING_PAYMENT_METHOD:")
    ) {
      return apiError("BAD_REQUEST", msg.split(": ")[1], 400);
    }
    return apiError("INTERNAL_ERROR", "Failed to promote candidate to student", 500);
  }
}
