import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { apiSuccess, apiError, parsePagination } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { FeeService } from "@/services/fee-service";

// Get midnight epoch in target timezone (returns absolute timestamp of local midnight)
function getLocalMidnightEpoch(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

/**
 * GET /api/v1/fees — list students with pending fees
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "fees", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const branchId = url.searchParams.get("branchId");

  try {
    const { rows, total } = await FeeService.listPendingFees(ctx, branchId, search, page, limit);
    return apiSuccess(rows, { page, limit, total });
  } catch (error) {
    console.error("List pending fees error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list pending fees", 500);
  }
}

/**
 * PATCH /api/v1/fees — Update invoice due date or waive late fees (Immediate Sync)
 */
export async function PATCH(req: NextRequest) {
  const denied = await checkApiPermission(req, "fees", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  try {
    const body = await req.json();
    const { invoiceId, dueDate, lateFeeWaived } = body;

    if (!invoiceId) {
      return apiError("BAD_REQUEST", "invoiceId is required", 400);
    }

    // 1. Fetch invoice and verify ownership/existence
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: ctx.organizationId,
        status: { not: "CANCELLED" },
      },
      include: {
        organization: { select: { timezone: true } },
      },
    });

    if (!invoice) {
      return apiError("NOT_FOUND", "Invoice not found or belongs to another tenant", 404);
    }

    const targetDueDate = dueDate ? new Date(dueDate) : invoice.dueDate;
    const targetWaived = lateFeeWaived !== undefined ? lateFeeWaived : invoice.lateFeeWaived;

    const tz = invoice.organization.timezone || "Asia/Kolkata";
    const currentLocalMidnight = getLocalMidnightEpoch(new Date(), tz);
    const dueLocalMidnight = getLocalMidnightEpoch(targetDueDate, tz);

    let nextAccumulated = invoice.lateFeeAccumulated;
    let nextStatus = invoice.status;

    if (targetWaived || dueLocalMidnight >= currentLocalMidnight) {
      nextAccumulated = new Prisma.Decimal(0);
      const paid = new Prisma.Decimal(invoice.paidAmount);
      const total = new Prisma.Decimal(invoice.totalAmount);
      nextStatus = paid.gte(total) ? "PAID" : paid.gt(0) ? "PARTIAL" : "PENDING";
    } else {
      const diffDays = Math.floor((currentLocalMidnight - dueLocalMidnight) / (1000 * 60 * 60 * 24));
      const daysOverdue = diffDays - invoice.lateFeeGrace;

      if (daysOverdue > 0 && invoice.lateFeeActive) {
        const value = new Prisma.Decimal(invoice.lateFeeValue);
        if (invoice.lateFeeType === "LUMP_SUM") {
          nextAccumulated = value;
        } else if (invoice.lateFeeType === "PERCENTAGE") {
          nextAccumulated = new Prisma.Decimal(invoice.totalAmount).mul(value).div(100);
        } else {
          // DAILY
          const rate = value.gt(0) ? value : new Prisma.Decimal(invoice.lateFeePerDay);
          nextAccumulated = rate.mul(daysOverdue);
        }
        nextStatus = "OVERDUE";
      } else {
        nextAccumulated = new Prisma.Decimal(0);
        const paid = new Prisma.Decimal(invoice.paidAmount);
        const total = new Prisma.Decimal(invoice.totalAmount);
        nextStatus = paid.gte(total) ? "PAID" : paid.gt(0) ? "PARTIAL" : "PENDING";
      }
    }

    // Upgraded: Optimistic Concurrency Control guard on updates
    const updatedInvoice = await prisma.invoice.update({
      where: {
        id: invoiceId,
        status: { not: "CANCELLED" },
      },
      data: {
        dueDate: targetDueDate,
        lateFeeWaived: targetWaived,
        lateFeeAccumulated: nextAccumulated,
        status: nextStatus,
      },
    });

    return apiSuccess({
      id: updatedInvoice.id,
      dueDate: updatedInvoice.dueDate,
      lateFeeWaived: updatedInvoice.lateFeeWaived,
      lateFeeAccumulated: Number(updatedInvoice.lateFeeAccumulated),
      status: updatedInvoice.status,
    });
  } catch (error) {
    console.error("Update fee invoice error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update invoice due date / waiver status", 500);
  }
}

