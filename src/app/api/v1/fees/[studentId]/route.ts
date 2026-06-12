import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createFeePaymentSchema } from "@/lib/validations/fee-payment";
import crypto from "crypto";
import { generateUniqueReceiptNo } from "@/lib/unique-id";
import { logAction } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

/**
 * GET /api/v1/fees/[studentId] — invoice detail + payment history
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "fees", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { studentId } = await context.params;

  try {
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId: ctx.organizationId,
        ...(ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId
          ? { branchId: ctx.branchId }
          : {}),
      },
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
      },
    });

    if (!student) {
      return apiNotFound("Student");
    }

    // Get all active (non-cancelled) invoices with items
    const activeInvoices = await prisma.invoice.findMany({
      where: {
        studentId,
        organizationId: ctx.organizationId,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        number: true,
        totalAmount: true,
        paidAmount: true,
        lateFeeAccumulated: true,
        status: true,
        dueDate: true,
        items: {
          select: {
            id: true,
            amount: true,
            description: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Get all payment records
    const payments = await prisma.feePayment.findMany({
      where: { studentId, organizationId: ctx.organizationId },
      select: {
        id: true,
        amount: true,
        method: true,
        transactionId: true,
        receiptNo: true,
        paidAt: true,
        remarks: true,
      },
      orderBy: { paidAt: "desc" },
    });

    const enrollment = student.enrollments[0];
    const className = enrollment
      ? `${enrollment.section.class.name} - ${enrollment.section.name}`
      : null;

    let consolidatedInvoice = null;
    if (activeInvoices.length > 0) {
      const totalAmount = activeInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount) + Number(inv.lateFeeAccumulated),
        0
      );
      const paidAmount = activeInvoices.reduce(
        (sum, inv) => sum + Number(inv.paidAmount),
        0
      );
      const pendingAmount = totalAmount - paidAmount;

      const hasOverdue = activeInvoices.some((inv) => {
        const isUnpaid = inv.status !== "PAID";
        const isPastDue = new Date(inv.dueDate) < new Date();
        return isUnpaid && isPastDue;
      });

      const status =
        pendingAmount <= 0
          ? "PAID"
          : hasOverdue
            ? "OVERDUE"
            : paidAmount > 0
              ? "PARTIAL"
              : "PENDING";

      const oldestUnpaid = activeInvoices.find((inv) => inv.status !== "PAID");
      const dueDate = oldestUnpaid
        ? oldestUnpaid.dueDate
        : activeInvoices[activeInvoices.length - 1].dueDate;

      const items: any[] = [];
      activeInvoices.forEach((inv) => {
        inv.items.forEach((item) => {
          items.push({
            id: item.id,
            description: `${item.description || "Fee"}${
              activeInvoices.length > 1 ? ` (${inv.number})` : ""
            }`,
            amount: Number(item.amount),
          });
        });

        if (Number(inv.lateFeeAccumulated) > 0) {
          items.push({
            id: `late-fee-${inv.id}`,
            description: `Late Fee Penalty (${inv.number})`,
            amount: Number(inv.lateFeeAccumulated),
          });
        }
      });

      consolidatedInvoice = {
        id: oldestUnpaid?.id || activeInvoices[activeInvoices.length - 1].id,
        number: oldestUnpaid?.number || activeInvoices[activeInvoices.length - 1].number,
        totalAmount,
        paidAmount,
        pendingAmount,
        status,
        dueDate,
        items,
      };
    }

    return apiSuccess({
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNo: student.admissionNo,
        photo: student.photo,
        branchName: student.branch.name,
        className,
      },
      invoice: consolidatedInvoice,
      invoices: activeInvoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        totalAmount: Number(inv.totalAmount) + Number(inv.lateFeeAccumulated),
        paidAmount: Number(inv.paidAmount),
        pendingAmount: Number(inv.totalAmount) + Number(inv.lateFeeAccumulated) - Number(inv.paidAmount),
        status: inv.status,
        dueDate: inv.dueDate,
        items: [
          ...inv.items.map((item) => ({
            id: item.id,
            description: item.description,
            amount: Number(item.amount),
          })),
          ...(Number(inv.lateFeeAccumulated) > 0
            ? [{
                id: `late-fee-${inv.id}`,
                description: "Late Fee Penalty",
                amount: Number(inv.lateFeeAccumulated),
              }]
            : [])
        ]
      })),
      payments: payments.map((p) => ({
        id: p.id,
        receiptNo: p.receiptNo,
        amount: Number(p.amount),
        method: p.method,
        transactionId: p.transactionId,
        paidAt: p.paidAt,
        remarks: p.remarks,
      })),
    });
  } catch (error) {
    console.error("Get student fees error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load fee details", 500);
  }
}

/**
 * POST /api/v1/fees/[studentId] — record a fee payment
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "fees", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { studentId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createFeePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const data = parsed.data;

  try {
    // Verify student belongs to this org
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
      return apiNotFound("Student");
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
      return apiError("BAD_REQUEST", "No outstanding dues found for this student", 400);
    }

    // Prioritize selected invoice if provided
    if (data.invoiceId) {
      const targetIndex = unpaidInvoices.findIndex((inv) => inv.id === data.invoiceId);
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

    const paymentAmountDecimal = new Prisma.Decimal(data.amount);
    if (paymentAmountDecimal.gt(totalPending)) {
      return apiError(
        "BAD_REQUEST",
        `Payment amount of ₹${data.amount} exceeds total outstanding dues of ₹${totalPending.toFixed(2)}`,
        400
      );
    }

    // Create payment + update invoices in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock all unpaid invoices to prevent concurrency race conditions
      let freshInvoices = await tx.$queryRaw<any[]>`
        SELECT id, totalAmount, paidAmount, lateFeeAccumulated, status, number FROM invoices 
        WHERE studentId = ${studentId} AND status IN ('PENDING', 'PARTIAL', 'OVERDUE') 
        ORDER BY dueDate ASC 
        FOR UPDATE
      `;

      // Prioritize selected invoice inside the locked transaction list
      if (data.invoiceId) {
        const targetIndex = freshInvoices.findIndex((inv) => inv.id === data.invoiceId);
        if (targetIndex > -1) {
          const [targetInv] = freshInvoices.splice(targetIndex, 1);
          freshInvoices = [targetInv, ...freshInvoices];
        }
      }

      // 1.5 Verify that the payment amount does not exceed the remaining outstanding balance inside the transaction
      let freshTotalPending = new Prisma.Decimal(0);
      for (const freshInv of freshInvoices) {
        const invTotal = new Prisma.Decimal(freshInv.totalAmount).plus(new Prisma.Decimal(freshInv.lateFeeAccumulated));
        const invPending = invTotal.minus(new Prisma.Decimal(freshInv.paidAmount));
        freshTotalPending = freshTotalPending.plus(invPending);
      }

      if (paymentAmountDecimal.gt(freshTotalPending)) {
        throw new Error(`OVERPAYMENT: Payment amount of ₹${data.amount} exceeds total outstanding dues of ₹${freshTotalPending.toFixed(2)}`);
      }

      let remainingPayment = paymentAmountDecimal;
      const createdPayments = [];
      let primaryPayment: any = null;

      // Generate a unified transaction ID if not provided, to group split allocations
      const unifiedTransactionId = data.transactionId || `TXN-FEE-${Date.now()}-${crypto.randomBytes ? crypto.randomBytes(4).toString("hex") : Math.random().toString(36).substring(7)}`;

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
            method: data.method,
            transactionId: unifiedTransactionId,
            receiptNo,
            paidAt: new Date(data.paidAt),
            remarks: data.remarks || null,
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
            amount: data.amount,
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

    return apiSuccess(result, undefined, 201);
  } catch (error: any) {
    console.error("Record fee payment error:", error);
    if (error?.message?.startsWith("OVERPAYMENT:")) {
      return apiError("BAD_REQUEST", error.message.replace("OVERPAYMENT: ", ""), 400);
    }
    return apiError("INTERNAL_ERROR", "Failed to record payment", 500);
  }
}
