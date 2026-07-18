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

type RouteContext = any;

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
    optionalFees,
  } = body as {
    sectionId: string;
    rollNo?: string;
    admissionDate?: string;
    discountPercent?: number;
    amountPaid?: number;
    paymentMethod?: "CASH" | "ONLINE" | "CHEQUE" | "BANK_TRANSFER" | "UPI";
    transactionId?: string;
    installments?: { 
      templateId?: string; 
      name?: string; 
      dueDate?: string; 
      amount: number;
      lateFeeActive?: boolean;
      lateFeeType?: "DAILY" | "FIXED" | "PERCENTAGE";
      lateFeeValue?: number;
      lateFeePerDay?: number;
      lateFeeGrace?: number;
    }[];
    termType?: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
    optionalFees?: { id: string; amount: number }[];
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
        where: {
          classId: application.classId,
          academicYearId: application.academicYearId,
          termType: termType || "FULL_TERM",
          OR: [
            { applicability: "MANDATORY" },
            { id: { in: optionalFees?.map(f => f.id) || [] } }
          ]
        },
        include: { feeCategory: { select: { name: true } } },
      });

      if (feeStructures.length === 0) {
        throw new Error("FEE_STRUCTURE_UNCONFIGURED: No active fee structures found for this class.");
      }

      // Security Check: Ensure all selected optional fees are actually marked as OPTIONAL in DB
      if (optionalFees && optionalFees.length > 0) {
        const optionalIds = optionalFees.map(f => f.id);
        const matchingStructures = feeStructures.filter(fs => optionalIds.includes(fs.id));
        if (matchingStructures.some(fs => fs.applicability !== "OPTIONAL")) {
           throw new Error("SECURITY_VIOLATION: Attempted to override a non-optional fee.");
        }
      }

      // Compute standard annual fees for each category
      const feeCategoriesAnnual = feeStructures.map((fs) => {
        let base = new Prisma.Decimal(fs.amount);
        let isOverridden = false;
        
        // Override amount if OPTIONAL and passed in payload
        if (fs.applicability === "OPTIONAL" && optionalFees) {
          const customOpt = optionalFees.find(o => o.id === fs.id);
          if (customOpt && customOpt.amount >= 0) {
             base = new Prisma.Decimal(customOpt.amount);
             isOverridden = true;
          }
        }
        
        let annual = base;
        switch (fs.frequency) {
          case "MONTHLY": annual = base.mul(12); break;
          case "QUARTERLY": annual = base.mul(4); break;
          case "SEMI_ANNUAL": annual = base.mul(2); break;
          default: annual = base;
        }
        return { 
          feeStructureId: fs.id, 
          name: fs.feeCategory.name, 
          annual, 
          applicability: fs.applicability,
          isOverridden,
          overriddenBase: base
        };
      });

      // Split Mandatory vs Optional for Discount Math
      const mandatoryTotal = feeCategoriesAnnual.filter(f => f.applicability === "MANDATORY").reduce((s, f) => s.plus(f.annual), new Prisma.Decimal(0));
      const optionalTotal = feeCategoriesAnnual.filter(f => f.applicability !== "MANDATORY").reduce((s, f) => s.plus(f.annual), new Prisma.Decimal(0));
      
      const discountPct = new Prisma.Decimal(discountPercent ?? 0);
      const discountMultiplier = new Prisma.Decimal(1).minus(discountPct.div(100));

      // Discount ONLY applies to Mandatory fees! (Discount Leakage Fix)
      const discountedMandatoryFee = mandatoryTotal.mul(discountMultiplier).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
      
      const totalDiscountedFee = discountedMandatoryFee.plus(optionalTotal);
      
      // Calculate effective discount ratio for the Invoice Items calculation below
      const annualTotal = mandatoryTotal.plus(optionalTotal);
      const totalDiscount = mandatoryTotal.minus(discountedMandatoryFee);

      const amountPaidDecimal = new Prisma.Decimal(amountPaid ?? 0);

      if (amountPaidDecimal.gt(0) && !paymentMethod) {
        throw new Error("MISSING_PAYMENT_METHOD: Upfront payment requires a payment method to be selected.");
      }

      if (amountPaidDecimal.gt(totalDiscountedFee)) {
        throw new Error(`OVERPAYMENT: Upfront payment of ₹${amountPaidDecimal.toFixed(2)} exceeds total discounted fee of ₹${totalDiscountedFee.toFixed(2)}.`);
      }

      // 1. Check if installment templates are setup or provided
      let targetInstallments: { name: string; amount: Prisma.Decimal; dueDate: Date; lateFeeActive: boolean; lateFeeType: string; lateFeeValue: Prisma.Decimal; lateFeePerDay: Prisma.Decimal; lateFeeGrace: number }[] = [];
      
      if (totalDiscountedFee.equals(0)) {
        // 100% Scholarship - No installments required
        targetInstallments = [];
      } else if (installments) {
        if (installments.length === 0) {
          throw new Error("INSTALLMENT_AMOUNT_MISMATCH: At least one fee installment must be selected.");
        }
        if (installments.some(inst => inst.amount < 0)) {
          throw new Error("INSTALLMENT_AMOUNT_MISMATCH: Installment amounts cannot be negative.");
        }
        const templateIds = installments.filter(i => i.templateId).map(i => i.templateId as string);
        const matchedTemplates = templateIds.length > 0 ? await tx.feeInstallmentTemplate.findMany({
          where: { id: { in: templateIds } },
        }) : [];

        targetInstallments = installments.map(inst => {
          const temp = inst.templateId ? matchedTemplates.find(t => t.id === inst.templateId) : null;
          return {
            name: inst.name || temp?.name || "Custom Installment",
            amount: new Prisma.Decimal(inst.amount),
            dueDate: inst.dueDate ? new Date(inst.dueDate) : (temp?.dueDate || new Date()),
            lateFeeActive: inst.lateFeeActive ?? (temp?.lateFeeActive || false),
            lateFeeType: inst.lateFeeType || temp?.lateFeeType || "DAILY",
            lateFeeValue: new Prisma.Decimal(inst.lateFeeValue ?? (temp ? Number(temp.lateFeeValue) : 0)),
            lateFeePerDay: new Prisma.Decimal(inst.lateFeePerDay ?? (temp ? Number(temp.lateFeePerDay) : 0)),
            lateFeeGrace: inst.lateFeeGrace ?? (temp?.lateFeeGrace || 0),
          };
        });

        const totalCustomAmount = targetInstallments.reduce((sum, inst) => sum.plus(inst.amount), new Prisma.Decimal(0));
        if (!totalCustomAmount.equals(totalDiscountedFee)) {
          throw new Error(`INSTALLMENT_AMOUNT_MISMATCH: The sum of custom installments (₹${totalCustomAmount}) must exactly match the total onboarding fee (₹${totalDiscountedFee}).`);
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

      // Update application status to ADMITTED
      await tx.admissionApplication.update({
        where: { id },
        data: { status: "ADMITTED" },
      });

      // 5. Create StudentFeeAssignment records for recurring billing future-proofing
      await tx.studentFeeAssignment.createMany({
        data: feeCategoriesAnnual.map(f => ({
          organizationId: ctx.organizationId,
          branchId: application.branchId,
          studentId: studentRecord.id,
          feeStructureId: f.feeStructureId,
          isOptedIn: true,
          customAmount: f.isOverridden ? f.overriddenBase : null,
          discountPercent: f.applicability === "MANDATORY" ? discountPercent : null,
        })),
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
  } catch (error: any) {
    console.error("Promote candidate error:", error);
    if (
      error?.message?.startsWith("FEE_STRUCTURE_UNCONFIGURED:") ||
      error?.message?.startsWith("INSTALLMENT_AMOUNT_MISMATCH:") ||
      error?.message?.startsWith("OVERPAYMENT:") ||
      error?.message?.startsWith("MISSING_PAYMENT_METHOD:")
    ) {
      return apiError("BAD_REQUEST", error.message.split(": ")[1], 400);
    }
    return apiError("INTERNAL_ERROR", "Failed to promote candidate to student", 500);
  }
}
