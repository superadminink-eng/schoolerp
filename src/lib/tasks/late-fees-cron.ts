import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
 * Nightly batch task to calculate and apply late fee penalties for overdue invoices.
 * Can be triggered via cron or called programmatically for verification.
 */
export async function runLateFeesCalculation(currentDate: Date = new Date()) {
  console.log(`[LATE_FEES] Starting timezone-aware batch run for: ${currentDate.toISOString()}`);
  
  let updatedCount = 0;
  const batchSize = 100;
  let lastId: string | null = null; // Keyset pagination anchor

  try {
    while (true) {
      // Memory-Safe Keyset Pagination (prevents cursor-not-found crashes)
      const invoices: any[] = await prisma.invoice.findMany({
        take: batchSize,
        where: {
          id: lastId ? { gt: lastId } : undefined,
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          lateFeeActive: true,
          lateFeeWaived: false,
        },
        include: {
          organization: { select: { timezone: true } },
        },
        orderBy: { id: "asc" },
      });

      if (invoices.length === 0) break;

      lastId = invoices[invoices.length - 1].id;

      // Process batch concurrently
      const chunkPromises = invoices.map(async (inv: any) => {
        const tz = inv.organization.timezone || "Asia/Kolkata";
        
        const currentLocalMidnight = getLocalMidnightEpoch(currentDate, tz);
        const dueLocalMidnight = getLocalMidnightEpoch(new Date(inv.dueDate), tz);

        // 1. Handle Administrative Extension / Waiver Reset (Self-healing fallback)
        if (dueLocalMidnight >= currentLocalMidnight) {
          if (Number(inv.lateFeeAccumulated) > 0) {
            const hasPayments = Number(inv.paidAmount) > 0;
            try {
              // Optimistic Concurrency Control (OCC) guard
              await prisma.invoice.update({
                where: { 
                  id: inv.id,
                  status: { in: ["PENDING", "PARTIAL", "OVERDUE"] }
                },
                data: {
                  lateFeeAccumulated: 0,
                  status: hasPayments ? "PARTIAL" : "PENDING",
                },
              });
              updatedCount++;
            } catch (err) {
              // Record was updated/paid concurrently, skip gracefully
            }
          }
          return;
        }

        // 2. Calculate overdue calendar days
        const diffDays = Math.floor((currentLocalMidnight - dueLocalMidnight) / (1000 * 60 * 60 * 24));
        const daysOverdue = diffDays - inv.lateFeeGrace;

        if (daysOverdue > 0) {
          let accumulatedPenalty = new Prisma.Decimal(0);
          const value = new Prisma.Decimal(inv.lateFeeValue);

          if (inv.lateFeeType === "LUMP_SUM") {
            accumulatedPenalty = value;
          } else if (inv.lateFeeType === "PERCENTAGE") {
            accumulatedPenalty = new Prisma.Decimal(inv.totalAmount).mul(value).div(100);
          } else {
            // DAILY rate (fallback to legacy lateFeePerDay if value is 0)
            const rate = value.gt(0) ? value : new Prisma.Decimal(inv.lateFeePerDay);
            accumulatedPenalty = rate.mul(daysOverdue);
          }

          if (!accumulatedPenalty.equals(new Prisma.Decimal(inv.lateFeeAccumulated))) {
            try {
              // Optimistic Concurrency Control (OCC) guard
              await prisma.invoice.update({
                where: { 
                  id: inv.id, 
                  status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } 
                },
                data: {
                  lateFeeAccumulated: accumulatedPenalty,
                  status: "OVERDUE",
                },
              });
              updatedCount++;
            } catch (err) {
              // Record was updated/paid concurrently, skip gracefully
            }
          }
        }
      });

      await Promise.all(chunkPromises);
    }

    console.log(`[LATE_FEES] Batch run completed. Updated ${updatedCount} invoices.`);

    // Garbage Collect Expired Rate Limits
    try {
      const deletedLimits = await prisma.rateLimit.deleteMany({
        where: { expiresAt: { lt: currentDate } },
      });
      console.log(`[RATE_LIMIT_CLEANUP] Deleted ${deletedLimits.count} expired rate limit entries.`);
    } catch (error) {
      console.error("[RATE_LIMIT_CLEANUP] Error running cleanup:", error);
    }

    return { success: true, updatedCount };
  } catch (error) {
    console.error("[LATE_FEES] Error during batch calculation:", error);
    return { success: false, error };
  }
}

