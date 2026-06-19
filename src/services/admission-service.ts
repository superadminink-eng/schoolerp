import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { generateUniqueAdmissionNo, generateUniqueInvoiceNo, generateUniqueReceiptNo } from "@/lib/unique-id";
import crypto from "crypto";
import { logAction } from "@/lib/audit";
import { TenantContext } from "./fee-service";

export interface PromoteCandidateInput {
  sectionId: string;
  rollNo?: string;
  admissionDate?: string;
  discountPercent?: number;
  amountPaid?: number;
  paymentMethod?: "CASH" | "ONLINE" | "CHEQUE" | "BANK_TRANSFER" | "UPI";
  transactionId?: string;
  installments?: { templateId: string; amount: number }[];
  termType?: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
}

export class AdmissionService {
  /**
   * Promotes a candidate application to an admitted Student, generating enrollments, invoices and payments.
   */
  static async promoteCandidate(id: string, input: PromoteCandidateInput, ctx: TenantContext) {
    const branchScope = ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId
      ? { branchId: ctx.branchId }
      : {};

    // 1. Verify application exists and matches scope
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
      throw new Error("APPLICATION_NOT_FOUND");
    }

    if (application.status === "ADMITTED") {
      throw new Error("CANDIDATE_ALREADY_ADMITTED");
    }

    // Verify age limit (must be >= 3.0 years)
    const dob = new Date(application.dateOfBirth);
    const admDate = input.admissionDate ? new Date(input.admissionDate) : new Date();
    const ageAtAdmission = (admDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (ageAtAdmission < 3.0) {
      throw new Error("INVALID_AGE_UNDER_THREE");
    }

    // 2. Verify section links to correct class
    const section = await prisma.section.findFirst({
      where: {
        id: input.sectionId,
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
      throw new Error("SECTION_NOT_FOUND");
    }

    // 3. Promote in a transaction
    const student = await prisma.$transaction(async (tx) => {
      const admissionNo = await generateUniqueAdmissionNo(tx, ctx.organizationId);

      // Create official Student record
      const studentRecord = await tx.student.create({
        data: {
          branchId: application.branchId,
          organizationId: ctx.organizationId,
          admissionNo,
          rollNo: input.rollNo || null,
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
          admissionDate: input.admissionDate ? new Date(input.admissionDate) : new Date(),
          status: "ACTIVE",
        },
      });

      // Create Enrollment
      await tx.studentEnrollment.create({
        data: {
          studentId: studentRecord.id,
          academicYearId: application.academicYearId,
          sectionId: input.sectionId,
          rollNo: input.rollNo || null,
          termType: input.termType || "FULL_TERM",
        },
      });

      // Calculate fee structures
      const feeStructures = await tx.feeStructure.findMany({
        where: {
          classId: application.classId,
          academicYearId: application.academicYearId,
          termType: input.termType || "FULL_TERM",
        },
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

      const annualTotal = feeCategoriesAnnual.reduce((sum, f) => sum.plus(f.annual), new Prisma.Decimal(0));
      const discountPercent = input.discountPercent ?? 0;
      const discountMultiplier = new Prisma.Decimal(1).minus(new Prisma.Decimal(discountPercent).div(100));
      const totalDiscountedFee = annualTotal.mul(discountMultiplier);

      let targetInstallments = [];

      if (input.installments) {
        if (input.installments.length === 0) {
          throw new Error("INSTALLMENT_AMOUNT_MISMATCH: At least one fee installment must be selected.");
        }
        if (input.installments.some(inst => inst.amount <= 0)) {
          throw new Error("INSTALLMENT_AMOUNT_MISMATCH: All installment amounts must be greater than zero.");
        }
        
        const templateIds = input.installments.map(i => i.templateId);
        const matchedTemplates = await tx.feeInstallmentTemplate.findMany({
          where: { id: { in: templateIds } },
        });

        targetInstallments = input.installments.map(inst => {
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
        const classTemplates = await tx.feeInstallmentTemplate.findMany({
          where: {
            classId: application.classId,
            academicYearId: application.academicYearId,
            termType: input.termType || "FULL_TERM",
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

        let finalDueDate = new Date(inst.dueDate);
        const today = new Date();
        if (finalDueDate < today) {
          finalDueDate = today;
        }

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
      let remainingPayment = new Prisma.Decimal(input.amountPaid ?? 0);
      
      if (remainingPayment.gt(0) && input.paymentMethod) {
        createdInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        const unifiedTransactionId = input.transactionId || `TXN-ADM-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

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
              method: input.paymentMethod,
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

    return student;
  }
}
