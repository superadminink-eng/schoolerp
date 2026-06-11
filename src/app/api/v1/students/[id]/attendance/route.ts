import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/students/[id]/attendance — Retrieve attendance history and monthly summary for a student
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "students", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  try {
    // 1. Verify student exists in this tenant organization
    const student = await prisma.student.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        ...(ctx.roleName === "BRANCH_ADMIN" && ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    });

    if (!student) return apiNotFound("Student");

    // 2. Fetch attendances for this student
    const attendances = await prisma.studentAttendance.findMany({
      where: { studentId: id },
      orderBy: { date: "asc" },
    });

    // 3. Process aggregates and monthly summaries
    let totalClasses = attendances.length;
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let excusedDays = 0;

    const monthlySummary: Record<string, {
      present: number;
      absent: number;
      late: number;
      halfDay: number;
      excused: number;
      total: number;
      rate: number;
    }> = {};

    const history = attendances.map((att) => {
      const d = new Date(att.date);
      const monthKey = d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); // e.g. "June 2026"
      const status = att.status;

      switch (status) {
        case "PRESENT":
          presentDays++;
          break;
        case "ABSENT":
          absentDays++;
          break;
        case "LATE":
          lateDays++;
          break;
        case "HALF_DAY":
          halfDays++;
          break;
        case "EXCUSED":
          excusedDays++;
          break;
      }

      if (!monthlySummary[monthKey]) {
        monthlySummary[monthKey] = {
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          excused: 0,
          total: 0,
          rate: 0,
        };
      }

      const mStats = monthlySummary[monthKey];
      mStats.total++;
      switch (status) {
        case "PRESENT":
          mStats.present++;
          break;
        case "ABSENT":
          mStats.absent++;
          break;
        case "LATE":
          mStats.late++;
          break;
        case "HALF_DAY":
          mStats.halfDay++;
          break;
        case "EXCUSED":
          mStats.excused++;
          break;
      }

      return {
        id: att.id,
        date: att.date,
        status: att.status,
        remarks: att.remarks,
        markedBy: att.markedBy,
      };
    });

    for (const key of Object.keys(monthlySummary)) {
      const ms = monthlySummary[key];
      const activeDays = ms.present + ms.late + ms.excused + (ms.halfDay * 0.5);
      ms.rate = ms.total > 0 ? (activeDays / ms.total) * 100 : 0;
      ms.rate = Number(ms.rate.toFixed(1));
    }

    const overallActive = presentDays + lateDays + excusedDays + (halfDays * 0.5);
    const attendanceRate = totalClasses > 0 ? (overallActive / totalClasses) * 100 : 0;

    return apiSuccess({
      attendanceRate: Number(attendanceRate.toFixed(1)),
      totalClasses,
      presentDays,
      absentDays,
      lateDays,
      halfDays,
      excusedDays,
      history: history.reverse(), // latest first in list
      monthlySummary,
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load attendance records", 500);
  }
}
