import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Nightly batch task to calculate and apply late fee penalties for overdue invoices.
 * Can be triggered via cron or called programmatically for verification.
 */
export async function runLateFeesCalculation(currentDate: Date = new Date()) {
  console.log(`[LATE_FEES] Starting batch run for date: ${currentDate.toISOString()}`);
  
  try {
    // Find all active invoices that are not cancelled or fully paid
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        dueDate: { lt: currentDate },
        lateFeeActive: true,
        lateFeeWaived: false,
      },
    });

    console.log(`[LATE_FEES] Found ${overdueInvoices.length} potentially overdue invoices subject to late fees.`);

    let updatedCount = 0;

    for (const inv of overdueInvoices) {
      const dueDate = new Date(inv.dueDate);
      const graceDays = inv.lateFeeGrace;
      
      // Calculate days difference
      const diffTime = currentDate.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const daysOverdue = diffDays - graceDays;

      if (daysOverdue > 0) {
        let accumulatedPenalty = new Prisma.Decimal(0);
        const value = new Prisma.Decimal(inv.lateFeeValue);

        if (inv.lateFeeType === "LUMP_SUM") {
          accumulatedPenalty = value;
        } else if (inv.lateFeeType === "PERCENTAGE") {
          accumulatedPenalty = new Prisma.Decimal(inv.totalAmount).mul(value).div(100);
        } else {
          // DAILY rule (or fallback to legacy lateFeePerDay)
          const rate = value.gt(0) ? value : new Prisma.Decimal(inv.lateFeePerDay);
          accumulatedPenalty = rate.mul(daysOverdue);
        }
        
        // Only update database if the accumulated penalty is different
        if (!accumulatedPenalty.equals(new Prisma.Decimal(inv.lateFeeAccumulated))) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              lateFeeAccumulated: accumulatedPenalty,
              status: "OVERDUE", // Ensure status is set to OVERDUE
            },
          });
          updatedCount++;
        }
      }
    }

    console.log(`[LATE_FEES] Completed batch run. Updated ${updatedCount} invoices.`);
    return { success: true, updatedCount };
  } catch (error) {
    console.error("[LATE_FEES] Error during batch calculation:", error);
    return { success: false, error };
  }
}
