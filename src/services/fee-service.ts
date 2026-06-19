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

export interface InitialInvoiceInput {
  classId: string;
  discountPercent: number;
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
    const feeStructures = await tx.feeStructure.findMany({
      where: { classId: input.classId },
      include: { feeCategory: { select: { name: true } } },
    });

    if (feeStructures.length === 0) return null;

    // Compute annual amount per fee structure based on frequency
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
    const discountPct = new Prisma.Decimal(input.discountPercent ?? 0);
    const discountedTotal = annualTotal.mul(new Prisma.Decimal(1).minus(discountPct.div(100)));
    const amountPaid = Prisma.Decimal.min(new Prisma.Decimal(input.amountPaid ?? 0), discountedTotal);

    if (new Prisma.Decimal(input.amountPaid ?? 0).gt(discountedTotal)) {
      throw new Error("AMOUNT_EXCEEDS_TOTAL");
    }

    let status: "PENDING" | "PARTIAL" | "PAID" = "PENDING";
    if (amountPaid.gt(0) && amountPaid.gte(discountedTotal)) {
      status = "PAID";
    } else if (amountPaid.gt(0)) {
      status = "PARTIAL";
    }

    const invoiceNo = await generateUniqueInvoiceNo(tx, organizationId);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await tx.invoice.create({
      data: {
        studentId,
        organizationId,
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

    if (amountPaid.gt(0) && input.paymentMethod) {
      const receiptNo = await generateUniqueReceiptNo(tx, organizationId);
      await tx.feePayment.create({
        data: {
          invoiceId: invoice.id,
          studentId,
          organizationId,
          amount: amountPaid,
          method: input.paymentMethod as PaymentMethod,
          transactionId: input.transactionId || null,
          receiptNo,
        },
      });
    }

    return invoice;
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
            where: { status: { not: "CANCELLED" } },
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
}
