import { prisma } from "@/lib/prisma";
import { InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { generateUniqueInvoiceNo, generateUniqueReceiptNo } from "@/lib/unique-id";
import crypto from "crypto";
import { logAction } from "@/lib/audit";
import { buildTenantWhere, buildSearchWhere } from "@/lib/query-helpers";

export interface TenantContext {
  userId: string;
  roleId: string;
  roleName: string;
  organizationId: string;
  branchId: string | null;
}

export interface CustomInstallment {
  name: string;
  dueDate: string;
  amount: number;
}

export interface InitialInvoiceInput {
  classId: string;
  discountPercent?: number;
  discountAmount?: number;
  optionalFeeIds?: string[];
  customInstallments?: CustomInstallment[];
  amountPaid: number;
  paymentMethod?: string;
  transactionId?: string;
}

export interface RecordPaymentInput {
  amount: number;
  method: string;
  transactionId?: string;
  invoiceId?: string;
  paidAt: string | Date;
  remarks?: string;
}

export class FeeService {
  /**
   * Generates initial invoice and payment for a student's class fees.
   * Must run within an existing Prisma transaction context.
   */
  static async createInitialInvoice(
    tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
    studentId: string,
    organizationId: string,
    input: InitialInvoiceInput
  ) {
    const student = await tx.student.findUnique({ where: { id: studentId }, select: { branchId: true } });
    if (!student) throw new Error("STUDENT_NOT_FOUND");

    const feeStructures = await tx.feeStructure.findMany({
      where: { 
        classId: input.classId,
        OR: [
          { applicability: "MANDATORY" },
          { id: { in: input.optionalFeeIds || [] } }
        ]
      },
      include: { feeCategory: { select: { name: true } } },
    });

    if (feeStructures.length === 0) return null;

    // Create StudentFeeAssignments
    for (const fs of feeStructures) {
      await tx.studentFeeAssignment.create({
        data: {
          organizationId,
          branchId: student.branchId,
          studentId,
          feeStructureId: fs.id,
          isOptedIn: true,
          isWaived: false,
          discountPercent: input.discountPercent || null,
          discountAmount: input.discountAmount || null,
        }
      });
    }

    // Compute annual amount per fee structure based on frequency
    const feeItems = feeStructures.map((fs) => {
      const base = new Prisma.Decimal(fs.amount);
      let annual: Prisma.Decimal;
      switch (fs.frequency) {
        case "MONTHLY": annual = base.mul(12); break;
        case "QUARTERLY": annual = base.mul(4); break;
        case "SEMI_ANNUAL": annual = base.mul(2); break;
        default: annual = base;
      }
      return { feeStructureId: fs.id, name: fs.feeCategory.name, annual };
    });

    const annualTotal = feeItems.reduce((s, f) => s.plus(f.annual), new Prisma.Decimal(0));
    
    // Apply discount
    let totalDiscount = new Prisma.Decimal(input.discountAmount || 0);
    if (input.discountPercent) {
      totalDiscount = totalDiscount.plus(annualTotal.mul(new Prisma.Decimal(input.discountPercent).div(100)));
    }
    const discountedTotal = annualTotal.minus(totalDiscount);
    
    if (new Prisma.Decimal(input.amountPaid ?? 0).gt(discountedTotal)) {
      throw new Error("AMOUNT_EXCEEDS_TOTAL");
    }

    const invoices = [];
    let remainingPaid = new Prisma.Decimal(input.amountPaid ?? 0);

    const installments = input.customInstallments && input.customInstallments.length > 0
      ? input.customInstallments 
      : [{ name: "Annual Fee", dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(), amount: discountedTotal.toNumber() }];

    const sumInstallments = installments.reduce((s, i) => s.plus(new Prisma.Decimal(i.amount)), new Prisma.Decimal(0));
    if (!sumInstallments.toDecimalPlaces(2).equals(discountedTotal.toDecimalPlaces(2))) {
      throw new Error(`INSTALLMENTS_SUM_MISMATCH: Expected ${discountedTotal.toFixed(2)}, got ${sumInstallments.toFixed(2)}`);
    }

    for (const inst of installments) {
      const instAmount = new Prisma.Decimal(inst.amount);
      const ratio = discountedTotal.equals(0) ? new Prisma.Decimal(0) : instAmount.div(discountedTotal);
      
      let invoicePaid = new Prisma.Decimal(0);
      if (remainingPaid.gte(instAmount)) {
         invoicePaid = instAmount;
         remainingPaid = remainingPaid.minus(instAmount);
      } else if (remainingPaid.gt(0)) {
         invoicePaid = remainingPaid;
         remainingPaid = new Prisma.Decimal(0);
      }

      let status: "PENDING" | "PARTIAL" | "PAID" = "PENDING";
      if (invoicePaid.gt(0) && invoicePaid.gte(instAmount)) status = "PAID";
      else if (invoicePaid.gt(0)) status = "PARTIAL";

      const invoiceNo = await generateUniqueInvoiceNo(tx, organizationId);

      const invoice = await tx.invoice.create({
        data: {
          studentId,
          organizationId,
          number: invoiceNo,
          year: new Date(inst.dueDate).getFullYear(),
          month: new Date(inst.dueDate).getMonth() + 1,
          totalAmount: instAmount,
          paidAmount: invoicePaid,
          status,
          dueDate: new Date(inst.dueDate),
          remarks: `Installment: ${inst.name}`,
          items: {
            create: (() => {
              let distributedForThisInvoice = new Prisma.Decimal(0);
              return feeItems.map((fi, index) => {
                let finalItemAmt: Prisma.Decimal;
                
                if (index === feeItems.length - 1) {
                  // Penny Drop: Last item takes the exact remainder
                  finalItemAmt = instAmount.minus(distributedForThisInvoice);
                } else {
                  const rawItemAmt = fi.annual.mul(ratio);
                  const discountRatio = annualTotal.equals(0) ? new Prisma.Decimal(1) : new Prisma.Decimal(1).minus(totalDiscount.div(annualTotal));
                  // Round to 2 decimal places to simulate DB storage behavior
                  finalItemAmt = rawItemAmt.mul(discountRatio).toDecimalPlaces(2);
                }
                
                distributedForThisInvoice = distributedForThisInvoice.plus(finalItemAmt);
                
                return {
                  feeStructureId: fi.feeStructureId,
                  amount: finalItemAmt,
                  description: fi.name,
                };
              });
            })(),
          },
        },
      });
      invoices.push(invoice);

      // Edge Case 3: Create individual receipt per invoice to prevent Ledger mismatches
      if (invoicePaid.gt(0) && input.paymentMethod) {
        const receiptNo = await generateUniqueReceiptNo(tx as any, organizationId);
        await tx.feePayment.create({
          data: {
            invoiceId: invoice.id,
            studentId,
            organizationId,
            amount: invoicePaid,
            method: input.paymentMethod as PaymentMethod,
            transactionId: input.transactionId || null,
            receiptNo,
          }
        });
      }
    }



    return invoices;
  }

  /**
   * Retrieves paginated students with pending outstanding dues.
   */
  static async listPendingFees(
    ctx: TenantContext,
    branchFilter: string | null | undefined,
    search: string | null | undefined,
    page: number,
    limit: number
  ) {
    const studentWhere = {
      ...buildTenantWhere(ctx as any, branchFilter),
      invoices: {
        some: {
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] as InvoiceStatus[] },
          deletedAt: null,
        },
      },
      ...buildSearchWhere(search, ["firstName", "lastName", "admissionNo"]),
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: studentWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNo: true,
          photo: true,
          branch: { select: { id: true, name: true } },
          enrollments: {
            take: 1,
            orderBy: { enrolledAt: "desc" },
            select: {
              section: {
                select: {
                  name: true,
                  class: { select: { name: true } },
                },
              },
            },
          },
          invoices: {
            where: { status: { not: "CANCELLED" }, deletedAt: null },
            select: {
              id: true,
              totalAmount: true,
              paidAmount: true,
              status: true,
              dueDate: true,
            },
          },
        },
        orderBy: { firstName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.student.count({ where: studentWhere }),
    ]);

    const rows = students.map((s) => {
      const enrollment = s.enrollments[0];
      const className = enrollment
        ? `${enrollment.section.class.name} - ${enrollment.section.name}`
        : "—";

      let totalAmount = 0;
      let paidAmount = 0;
      let hasOverdue = false;
      const unpaidInvoices: typeof s.invoices = [];

      for (const inv of s.invoices) {
        totalAmount += Number(inv.totalAmount);
        paidAmount += Number(inv.paidAmount);

        if (
          inv.status === "PENDING" ||
          inv.status === "PARTIAL" ||
          inv.status === "OVERDUE"
        ) {
          unpaidInvoices.push(inv);
          if (inv.status === "OVERDUE") {
            hasOverdue = true;
          }
        }
      }

      const pendingAmount = totalAmount - paidAmount;

      let dueDate = null;
      if (unpaidInvoices.length > 0) {
        const dates = unpaidInvoices.map((inv) => new Date(inv.dueDate).getTime());
        dueDate = new Date(Math.min(...dates));
      }

      let status = "PAID";
      if (pendingAmount > 0) {
        if (hasOverdue) {
          status = "OVERDUE";
        } else if (paidAmount > 0) {
          status = "PARTIAL";
        } else {
          status = "PENDING";
        }
      }

      return {
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNo: s.admissionNo,
        photo: s.photo,
        className,
        branchName: s.branch.name,
        totalAmount,
        paidAmount,
        pendingAmount,
        status,
        dueDate,
      };
    });

    return { rows, total };
  }

  /**
   * Records a fee payment, distributing it across pending invoices within a safe database transaction.
   */
  static async recordPayment(studentId: string, input: RecordPaymentInput, ctx: TenantContext) {
    // Verify student belongs to organization
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId: ctx.organizationId,
        ...(ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId
          ? { branchId: ctx.branchId }
          : {}),
      },
    });

    if (!student) {
      throw new Error("STUDENT_NOT_FOUND");
    }

    // Find active unpaid invoices
    let unpaidInvoices = await prisma.invoice.findMany({
      where: {
        studentId,
        organizationId: ctx.organizationId,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
    });

    if (unpaidInvoices.length === 0) {
      throw new Error("NO_OUTSTANDING_DUES");
    }

    // Prioritize selected invoice if specified
    if (input.invoiceId) {
      const targetIndex = unpaidInvoices.findIndex((inv) => inv.id === input.invoiceId);
      if (targetIndex > -1) {
        const [targetInv] = unpaidInvoices.splice(targetIndex, 1);
        unpaidInvoices = [targetInv, ...unpaidInvoices];
      }
    }

    let totalPending = new Prisma.Decimal(0);
    unpaidInvoices.forEach((inv) => {
      const invTotal = new Prisma.Decimal(inv.totalAmount).plus(new Prisma.Decimal(inv.lateFeeAccumulated));
      const invPending = invTotal.minus(new Prisma.Decimal(inv.paidAmount));
      totalPending = totalPending.plus(invPending);
    });

    const paymentAmountDecimal = new Prisma.Decimal(input.amount);
    if (paymentAmountDecimal.gt(totalPending)) {
      throw new Error(`OVERPAYMENT: Payment amount exceeds outstanding balance of ₹${totalPending.toFixed(2)}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock all unpaid invoices to prevent concurrency race conditions
      let freshInvoices = await tx.$queryRaw<any[]>`
        SELECT id, totalAmount, paidAmount, lateFeeAccumulated, status, number FROM invoices 
        WHERE studentId = ${studentId} AND status IN ('PENDING', 'PARTIAL', 'OVERDUE') 
        ORDER BY dueDate ASC 
        FOR UPDATE
      `;

      // Prioritize selected invoice inside the locked list
      if (input.invoiceId) {
        const targetIndex = freshInvoices.findIndex((inv) => inv.id === input.invoiceId);
        if (targetIndex > -1) {
          const [targetInv] = freshInvoices.splice(targetIndex, 1);
          freshInvoices = [targetInv, ...freshInvoices];
        }
      }

      // Re-verify totals inside transaction
      let freshTotalPending = new Prisma.Decimal(0);
      for (const freshInv of freshInvoices) {
        const invTotal = new Prisma.Decimal(freshInv.totalAmount).plus(new Prisma.Decimal(freshInv.lateFeeAccumulated));
        const invPending = invTotal.minus(new Prisma.Decimal(freshInv.paidAmount));
        freshTotalPending = freshTotalPending.plus(invPending);
      }

      if (paymentAmountDecimal.gt(freshTotalPending)) {
        throw new Error(`OVERPAYMENT: Payment amount exceeds outstanding balance of ₹${freshTotalPending.toFixed(2)}`);
      }

      let remainingPayment = paymentAmountDecimal;
      const createdPayments = [];
      let primaryPayment: any = null;

      const unifiedTransactionId = input.transactionId || `TXN-FEE-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

      for (const freshInv of freshInvoices) {
        if (remainingPayment.lte(0)) break;

        const invTotal = new Prisma.Decimal(freshInv.totalAmount).plus(new Prisma.Decimal(freshInv.lateFeeAccumulated));
        const invPaid = new Prisma.Decimal(freshInv.paidAmount);
        const invPending = invTotal.minus(invPaid);

        if (invPending.lte(0)) continue;

        const paymentToApply = remainingPayment.lt(invPending) ? remainingPayment : invPending;
        const newPaidAmount = invPaid.plus(paymentToApply);
        const newStatus = newPaidAmount.gte(invTotal) ? "PAID" : "PARTIAL";

        const receiptNo = await generateUniqueReceiptNo(tx, ctx.organizationId);

        const payment = await tx.feePayment.create({
          data: {
            invoiceId: freshInv.id,
            studentId,
            organizationId: ctx.organizationId,
            amount: paymentToApply,
            method: input.method as PaymentMethod,
            transactionId: unifiedTransactionId,
            receiptNo,
            paidAt: new Date(input.paidAt),
            remarks: input.remarks || null,
          },
          select: {
            id: true,
            receiptNo: true,
            amount: true,
            method: true,
            transactionId: true,
            paidAt: true,
            remarks: true,
          },
        });

        if (!primaryPayment) {
          primaryPayment = payment;
        }

        createdPayments.push(payment);

        await tx.invoice.update({
          where: { id: freshInv.id },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
          },
        });

        remainingPayment = remainingPayment.minus(paymentToApply);
      }

      // Write audit log
      if (primaryPayment) {
        await logAction({
          organizationId: ctx.organizationId,
          branchId: student.branchId,
          userId: ctx.userId,
          action: "CREATE",
          module: "fees",
          entityId: primaryPayment.id,
          details: {
            receiptNo: primaryPayment.receiptNo,
            amount: input.amount,
            studentName: `${student.firstName} ${student.lastName}`,
            splitCount: createdPayments.length,
          },
        });
      }

      return {
        payment: primaryPayment
          ? {
              ...primaryPayment,
              amount: Number(primaryPayment.amount),
            }
          : null,
        paymentsCount: createdPayments.length,
      };
    }, { timeout: 15000 });

    return result;
  }

  /**
   * Phase 4: Mid-Year Services API
   * Adds a new service (FeeStructure) to an existing student mid-year.
   * Modifies PENDING invoices directly or generates a SUPPLEMENTARY invoice.
   */
  static async addMidYearService(
    ctx: TenantContext,
    studentId: string,
    feeStructureId: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        include: { branch: true },
      });
      if (!student) throw new Error("STUDENT_NOT_FOUND");

      const feeStructure = await tx.feeStructure.findUnique({
        where: { id: feeStructureId },
        include: { feeCategory: true }
      });
      if (!feeStructure) throw new Error("FEE_STRUCTURE_NOT_FOUND");

      // 1. Check if already opted in
      const existingAssignment = await tx.studentFeeAssignment.findUnique({
        where: { studentId_feeStructureId: { studentId, feeStructureId } }
      });

      if (existingAssignment) {
        if (existingAssignment.isOptedIn) throw new Error("SERVICE_ALREADY_ACTIVE");
        // Reactivate
        await tx.studentFeeAssignment.update({
          where: { id: existingAssignment.id },
          data: { isOptedIn: true }
        });
      } else {
        // Create new assignment
        await tx.studentFeeAssignment.create({
          data: {
            organizationId: student.organizationId,
            branchId: student.branchId,
            studentId,
            feeStructureId,
            isOptedIn: true,
            isWaived: false,
          }
        });
      }

      // 2. Prorate logic (Edge Case 1: Dynamic Calculation based on Remaining Months)
      const currentAcademicYear = await tx.academicYear.findFirst({
        where: { organizationId: student.organizationId, isCurrent: true }
      });
      
      let remainingMonths = 12;
      if (currentAcademicYear) {
        const now = new Date();
        const end = new Date(currentAcademicYear.endDate);
        if (end > now) {
          remainingMonths = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + 1;
          if (remainingMonths < 1) remainingMonths = 1;
          if (remainingMonths > 12) remainingMonths = 12;
        } else {
          remainingMonths = 1;
        }
      }

      let amountToAdd = new Prisma.Decimal(feeStructure.amount);
      switch (feeStructure.frequency) {
        case "MONTHLY": amountToAdd = amountToAdd.mul(remainingMonths); break;
        case "QUARTERLY": amountToAdd = amountToAdd.mul(Math.ceil(remainingMonths / 3)); break;
        case "SEMI_ANNUAL": amountToAdd = amountToAdd.mul(Math.ceil(remainingMonths / 6)); break;
      }

      // 3. Find future PENDING invoices
      const pendingInvoices = await tx.invoice.findMany({
        where: { studentId, status: "PENDING" },
        orderBy: { dueDate: "asc" }
      });

      if (pendingInvoices.length > 0) {
        // Split amountToAdd across pending invoices
        const splitAmount = amountToAdd.div(pendingInvoices.length).toDecimalPlaces(2);
        const remainder = amountToAdd.minus(splitAmount.mul(pendingInvoices.length));

        for (let i = 0; i < pendingInvoices.length; i++) {
          const inv = pendingInvoices[i];
          const itemAmount = (i === pendingInvoices.length - 1) ? splitAmount.plus(remainder) : splitAmount;

          await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              feeStructureId: feeStructure.id,
              description: feeStructure.feeCategory.name,
              amount: itemAmount
            }
          });

          await tx.invoice.update({
            where: { id: inv.id },
            data: { totalAmount: new Prisma.Decimal(inv.totalAmount).plus(itemAmount) }
          });
        }
      } else {
        // No pending invoices, create SUPPLEMENTARY invoice
        const invoiceNo = await generateUniqueInvoiceNo(tx as any, student.organizationId);
        await tx.invoice.create({
          data: {
            organizationId: student.organizationId,
            studentId,
            number: invoiceNo,
            year: new Date().getFullYear(),
            type: "SUPPLEMENTARY",
            status: "PENDING",
            dueDate: new Date(new Date().setDate(new Date().getDate() + 15)), // 15 days from now
            totalAmount: amountToAdd,
            paidAmount: 0,
            lateFeeAccumulated: 0,
            remarks: `Mid-year addition of ${feeStructure.feeCategory.name}`,
            items: {
              create: [{
                feeStructureId: feeStructure.id,
                description: feeStructure.feeCategory.name,
                amount: amountToAdd
              }]
            }
          }
        });
      }

      await logAction({
        organizationId: ctx.organizationId,
        branchId: student.branchId,
        userId: ctx.userId,
        action: "UPDATE",
        module: "services",
        entityId: studentId,
        details: { action: "ADD_SERVICE", feeStructureId, amount: Number(amountToAdd) }
      });

      return { success: true, amountAdded: Number(amountToAdd) };
    });
  }

  /**
   * Phase 4: Mid-Year Services API
   * Removes a service (FeeStructure) from an existing student mid-year.
   * Deducts from PENDING invoices or credits Student Wallet.
   */
  static async removeMidYearService(
    ctx: TenantContext,
    studentId: string,
    feeStructureId: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        include: { branch: true },
      });
      if (!student) throw new Error("STUDENT_NOT_FOUND");

      const assignment = await tx.studentFeeAssignment.findUnique({
        where: { studentId_feeStructureId: { studentId, feeStructureId } },
        include: { feeStructure: { include: { feeCategory: true } } }
      });

      if (!assignment || !assignment.isOptedIn) {
        throw new Error("SERVICE_NOT_ACTIVE");
      }

      // Mark Opted Out
      await tx.studentFeeAssignment.update({
        where: { id: assignment.id },
        data: { isOptedIn: false }
      });

      // Edge Case 2: Find PENDING, PARTIAL, OVERDUE invoices containing this service
      const pendingInvoiceItems = await tx.invoiceItem.findMany({
        where: {
          feeStructureId,
          invoice: { studentId, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }
        },
        include: { invoice: true }
      });

      let amountRecovered = new Prisma.Decimal(0);

      for (const item of pendingInvoiceItems) {
        amountRecovered = amountRecovered.plus(item.amount);
        
        await tx.invoiceItem.delete({ where: { id: item.id } });
        
        const newTotal = new Prisma.Decimal(item.invoice.totalAmount).minus(item.amount);
        let newStatus = item.invoice.status;
        
        // If the invoice was PARTIAL/OVERDUE and now the paid amount covers the new total, mark as PAID
        if (new Prisma.Decimal(item.invoice.paidAmount).gte(newTotal)) {
           newStatus = "PAID";
        }

        await tx.invoice.update({
          where: { id: item.invoiceId },
          data: { 
            totalAmount: newTotal,
            status: newStatus as InvoiceStatus
          }
        });
      }

      // If they had already paid for it (not in pending), we credit it to advanceBalance
      // Proper prorating would calculate the exact unused portion.
      // Here we assume any amount not found in PENDING is ALREADY PAID and needs refunding to wallet.
      
      // Let's compute expected total
      let totalAnnual = new Prisma.Decimal(assignment.feeStructure.amount);
      switch (assignment.feeStructure.frequency) {
        case "MONTHLY": totalAnnual = totalAnnual.mul(12); break;
        case "QUARTERLY": totalAnnual = totalAnnual.mul(4); break;
        case "SEMI_ANNUAL": totalAnnual = totalAnnual.mul(2); break;
      }

      const amountAlreadyPaid = totalAnnual.minus(amountRecovered);

      if (amountAlreadyPaid.gt(0)) {
        await tx.student.update({
          where: { id: studentId },
          data: { advanceBalance: new Prisma.Decimal(student.advanceBalance).plus(amountAlreadyPaid) }
        });
      }

      await logAction({
        organizationId: ctx.organizationId,
        branchId: student.branchId,
        userId: ctx.userId,
        action: "UPDATE",
        module: "services",
        entityId: studentId,
        details: { action: "REMOVE_SERVICE", feeStructureId, refundedToWallet: Number(amountAlreadyPaid) }
      });

      return { success: true, removedFromPending: Number(amountRecovered), refundedToWallet: Number(amountAlreadyPaid) };
    });
  }
}
