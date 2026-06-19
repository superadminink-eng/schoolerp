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
import { FeeService } from "@/services/fee-service";

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
    const result = await FeeService.recordPayment(studentId, data, ctx);
    return apiSuccess(result, undefined, 201);
  } catch (error: any) {
    if (error.message === "STUDENT_NOT_FOUND") {
      return apiNotFound("Student");
    }
    if (error.message === "NO_OUTSTANDING_DUES") {
      return apiError("BAD_REQUEST", "No outstanding dues found for this student", 400);
    }
    if (error.message?.startsWith("OVERPAYMENT:")) {
      return apiError("BAD_REQUEST", error.message.replace("OVERPAYMENT: ", ""), 400);
    }
    console.error("Record fee payment error:", error);
    return apiError("INTERNAL_ERROR", "Failed to record payment", 500);
  }
}

