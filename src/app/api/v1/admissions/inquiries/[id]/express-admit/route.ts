import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { expressAdmitSchema } from "@/lib/validations/express-admission";
import crypto from "crypto";
import {
  generateUniqueAdmissionNo,
  generateUniqueInvoiceNo,
  generateUniqueReceiptNo,
  generateUniqueApplicationNo,
} from "@/lib/unique-id";
import { logAction } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

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
 * POST /api/v1/admissions/inquiries/[id]/express-admit
 * Express promote an inquiry directly to student, bypassing manual application and verification stages.
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

  const parsed = expressAdmitSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", "Validation failed", 400);
  }

  const {
    sectionId,
    rollNo,
    admissionDate,
    discountPercent,
    amountPaid,
    paymentMethod,
    transactionId,
    termType,
    installments,
  } = parsed.data;

  const { bypassAgeLimit } = body as { bypassAgeLimit?: boolean };

  try {
    const branchScope = ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId
      ? { branchId: ctx.branchId }
      : {};

    // 1. Fetch Inquiry
    const inquiry = await prisma.admissionInquiry.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        ...branchScope,
      },
    });

    if (!inquiry) {
      return apiError("NOT_FOUND", "Inquiry not found in current scope", 404);
    }

    if (inquiry.status === "APPLIED") {
      // Check if already has application
      const existingApp = await prisma.admissionApplication.findFirst({
        where: { inquiryId: id },
      });
      if (existingApp && existingApp.status === "ADMITTED") {
        return apiError("CONFLICT", "Candidate from this inquiry has already been admitted", 409);
      }
    }

    // Age validation (bypassable with flag)
    const dob = new Date(inquiry.dateOfBirth);
    const admDate = admissionDate ? new Date(admissionDate) : new Date();
    const ageAtAdmission = (admDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (ageAtAdmission < 3.0 && !bypassAgeLimit) {
      return apiError("BAD_REQUEST", "Student must be at least 3 years old on the admission date", 400);
    }

    // 2. Verify Section
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        class: {
          id: inquiry.classAppliedId,
          branchId: inquiry.branchId,
        },
      },
      include: {
        class: true,
      },
    });

    if (!section) {
      return apiError("NOT_FOUND", "Selected class section not found", 404);
    }

    const { firstName, lastName } = splitFullName(inquiry.studentName);

    // 3. Database Transaction
    const student = await prisma.$transaction(async (tx) => {
      // a. Create AdmissionApplication programmatically
      const applicationNo = await generateUniqueApplicationNo(tx, ctx.organizationId);
      const application = await tx.admissionApplication.create({
        data: {
          inquiryId: id,
          organizationId: ctx.organizationId,
          branchId: inquiry.branchId,
          academicYearId: inquiry.academicYearId,
          classId: inquiry.classAppliedId,
          applicationNo,
          firstName,
          lastName,
          dateOfBirth: inquiry.dateOfBirth,
          gender: inquiry.gender,
          address: "N/A",
          pincode: "000000",
          emergencyContact: inquiry.parentPhone,
          fatherName: inquiry.parentName,
          fatherPhone: inquiry.parentPhone,
          fatherEmail: inquiry.parentEmail,
          status: "ADMITTED",
          applicationFeePaid: true,
        },
      });

      // b. Create Student profile
      const admissionNo = await generateUniqueAdmissionNo(tx, ctx.organizationId);
      const studentRecord = await tx.student.create({
        data: {
          branchId: inquiry.branchId,
          organizationId: ctx.organizationId,
          admissionNo,
          rollNo: rollNo || null,
          firstName,
          lastName,
          dateOfBirth: inquiry.dateOfBirth,
          gender: inquiry.gender,
          address: "N/A",
          pincode: "000000",
          emergencyContact1: inquiry.parentPhone,
          fatherName: inquiry.parentName,
          fatherPhone: inquiry.parentPhone,
          fatherEmail: inquiry.parentEmail,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          status: "ACTIVE",
        },
      });

      // c. Create StudentEnrollment
      await tx.studentEnrollment.create({
        data: {
          studentId: studentRecord.id,
          academicYearId: inquiry.academicYearId,
          sectionId,
          rollNo: rollNo || null,
          termType: termType || "FULL_TERM",
        },
      });

      // d. Billing generation (copied from promote endpoint)
      const feeStructures = await tx.feeStructure.findMany({
        where: { classId: inquiry.classAppliedId, termType: termType || "FULL_TERM" },
        include: { feeCategory: { select: { name: true } } },
      });

      if (feeStructures.length === 0) {
        throw new Error("FEE_STRUCTURE_UNCONFIGURED: No active fee structures found for this class.");
      }

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

      let targetInstallments: { name: string; amount: Prisma.Decimal; dueDate: Date; lateFeeActive: boolean; lateFeeType: string; lateFeeValue: Prisma.Decimal; lateFeePerDay: Prisma.Decimal; lateFeeGrace: number }[] = [];
      
      if (installments) {
        if (installments.length === 0) {
          throw new Error("INSTALLMENT_AMOUNT_MISMATCH: At least one fee installment must be selected.");
        }
        if (installments.some(inst => inst.amount <= 0)) {
          throw new Error("INSTALLMENT_AMOUNT_MISMATCH: All installment amounts must be greater than zero.");
        }
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
        if (!totalCustomAmount.equals(totalDiscountedFee)) {
          throw new Error(`INSTALLMENT_AMOUNT_MISMATCH: The sum of custom installments (₹${totalCustomAmount}) does not match the total discounted fee structures (₹${totalDiscountedFee}).`);
        }
      } else {
        const classTemplates = await tx.feeInstallmentTemplate.findMany({
          where: {
            classId: inquiry.classAppliedId,
            academicYearId: inquiry.academicYearId,
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
          const fallbackTemplate = await tx.feeInstallmentTemplate.findFirst({
            where: { classId: inquiry.classAppliedId },
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

      // Apply payment rollover
      let remainingPayment = new Prisma.Decimal(amountPaid ?? 0);
      
      if (remainingPayment.gt(0) && paymentMethod) {
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

      // e. Update Inquiry status to APPLIED
      await tx.admissionInquiry.update({
        where: { id },
        data: { status: "APPLIED" },
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
      details: { admissionNo: student.admissionNo, name: `${student.firstName} ${student.lastName}`, expressPromotedFrom: id }
    });

    return apiSuccess(student, undefined, 201);
  } catch (error: any) {
    console.error("Express admit candidate error:", error);
    if (
      error?.message?.startsWith("FEE_STRUCTURE_UNCONFIGURED:") ||
      error?.message?.startsWith("INSTALLMENT_AMOUNT_MISMATCH:") ||
      error?.message?.startsWith("OVERPAYMENT:") ||
      error?.message?.startsWith("MISSING_PAYMENT_METHOD:")
    ) {
      return apiError("BAD_REQUEST", error.message.split(": ")[1], 400);
    }
    return apiError("INTERNAL_ERROR", "Failed to express admit candidate", 500);
  }
}
