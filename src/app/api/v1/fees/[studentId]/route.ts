import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createFeePaymentSchema } from "@/lib/validations/fee-payment";
import crypto from "crypto";

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
        branch: { organizationId: ctx.organizationId },
        ...(ctx.roleName === "BRANCH_ADMIN" && ctx.branchId
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

    // Get the active (non-cancelled) invoice with items
    const invoice = await prisma.invoice.findFirst({
      where: {
        studentId,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        number: true,
        totalAmount: true,
        paidAmount: true,
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
      orderBy: { createdAt: "desc" },
    });

    // Get all payment records
    const payments = await prisma.feePayment.findMany({
      where: { studentId },
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
      invoice: invoice
        ? {
            id: invoice.id,
            number: invoice.number,
            totalAmount: Number(invoice.totalAmount),
            paidAmount: Number(invoice.paidAmount),
            pendingAmount:
              Number(invoice.totalAmount) - Number(invoice.paidAmount),
            status: invoice.status,
            dueDate: invoice.dueDate,
            items: invoice.items.map((item) => ({
              id: item.id,
              description: item.description,
              amount: Number(item.amount),
            })),
          }
        : null,
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
        branch: { organizationId: ctx.organizationId },
        ...(ctx.roleName === "BRANCH_ADMIN" && ctx.branchId
          ? { branchId: ctx.branchId }
          : {}),
      },
    });

    if (!student) {
      return apiNotFound("Student");
    }

    // Find active invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        studentId,
        status: { not: "CANCELLED" },
      },
    });

    if (!invoice) {
      return apiError("NOT_FOUND", "No active invoice found for this student", 404);
    }

    const totalAmount = Number(invoice.totalAmount);
    const paidAmount = Number(invoice.paidAmount);
    const pendingAmount = totalAmount - paidAmount;

    if (data.amount > pendingAmount) {
      return apiError(
        "VALIDATION_ERROR",
        `Amount exceeds pending balance of ₹${pendingAmount.toLocaleString("en-IN")}`,
        422
      );
    }

    // Create payment + update invoice in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const receiptNo = `RCP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const newPaidAmount = paidAmount + data.amount;
      const newStatus = newPaidAmount >= totalAmount ? "PAID" : "PARTIAL";

      const payment = await tx.feePayment.create({
        data: {
          invoiceId: invoice.id,
          studentId,
          amount: data.amount,
          method: data.method,
          transactionId: data.transactionId || null,
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

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      return {
        payment: {
          ...payment,
          amount: Number(payment.amount),
        },
        invoice: {
          id: invoice.id,
          totalAmount,
          paidAmount: newPaidAmount,
          pendingAmount: totalAmount - newPaidAmount,
          status: newStatus,
        },
      };
    }, { timeout: 15000 });

    return apiSuccess(result, undefined, 201);
  } catch (error) {
    console.error("Record fee payment error:", error);
    return apiError("INTERNAL_ERROR", "Failed to record payment", 500);
  }
}
