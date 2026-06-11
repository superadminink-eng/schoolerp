import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiUnauthorized();

  const orgId = session.user.organizationId;

  // Extract branchId from query parameter for global roles, fallback to session branchId
  const url = new URL(req.url);
  const queryBranchId = url.searchParams.get("branchId");
  const isBranchScoped = session.user.roleName === "BRANCH_ADMIN";

  let branchId = session.user.branchId;
  if (!isBranchScoped && queryBranchId !== null) {
    branchId = queryBranchId || null;
  }

  const branchWhere = {
    branch: {
      organizationId: orgId,
      ...(branchId ? { id: branchId } : {}),
    },
  };

  // 1. Core Counts
  const [students, staff, branches, users] = await Promise.all([
    prisma.student.count({
      where: { ...branchWhere, status: "ACTIVE" },
    }),
    prisma.staff.count({
      where: { ...branchWhere, status: "ACTIVE" },
    }),
    prisma.branch.count({
      where: { organizationId: orgId, isActive: true },
    }),
    prisma.user.count({
      where: { organizationId: orgId, isActive: true },
    }),
  ]);

  // 2. Attendance rates (latest recorded date)
  const latestAttendance = await prisma.studentAttendance.findFirst({
    where: branchId ? { branchId } : {},
    orderBy: { date: "desc" },
    select: { date: true },
  });

  let attendanceSummary = { present: 0, absent: 0, late: 0, total: 0, rate: 0 };
  if (latestAttendance) {
    const logs = await prisma.studentAttendance.findMany({
      where: {
        branchId: branchId || undefined,
        date: latestAttendance.date,
      },
      select: { status: true },
    });

    logs.forEach(log => {
      attendanceSummary.total++;
      if (log.status === "PRESENT") attendanceSummary.present++;
      else if (log.status === "ABSENT") attendanceSummary.absent++;
      else if (log.status === "LATE") attendanceSummary.late++;
    });

    if (attendanceSummary.total > 0) {
      attendanceSummary.rate = Math.round(
        ((attendanceSummary.present + attendanceSummary.late) / attendanceSummary.total) * 100
      );
    }
  }

  // 3. Financial Health
  const invoiceAgg = await prisma.invoice.aggregate({
    where: {
      student: branchId ? { branchId } : {},
      status: { not: "CANCELLED" },
    },
    _sum: {
      totalAmount: true,
      paidAmount: true,
    },
  });

  const totalInvoiced = Number(invoiceAgg._sum.totalAmount || 0);
  const totalCollected = Number(invoiceAgg._sum.paidAmount || 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalCollected);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

  const recentPayments = await prisma.feePayment.findMany({
    where: {
      student: branchId ? { branchId } : {},
    },
    orderBy: { paidAt: "desc" },
    take: 5,
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          admissionNo: true,
        },
      },
    },
  });

  const formattedPayments = recentPayments.map(p => ({
    id: p.id,
    studentName: `${p.student.firstName} ${p.student.lastName}`,
    admissionNo: p.student.admissionNo,
    amount: Number(p.amount),
    method: p.method,
    paidAt: p.paidAt.toISOString(),
  }));

  // 4. Portal Announcements (Notices)
  const recentNotices = await prisma.notice.findMany({
    where: {
      organizationId: orgId,
      isPublished: true,
      OR: [
        { branchId: null },
        { branchId: branchId || undefined },
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  // 5. Academic Events
  const upcomingEvents = await prisma.event.findMany({
    where: {
      branchId: branchId || undefined,
      startDate: {
        gte: new Date(),
      },
    },
    orderBy: { startDate: "asc" },
    take: 3,
  });

  // 6. Operational Status Counts
  const [classesCount, sectionsCount, vehiclesCount, booksCount] = await Promise.all([
    prisma.class.count({
      where: { branchId: branchId || undefined },
    }),
    prisma.section.count({
      where: { class: { branchId: branchId || undefined } },
    }),
    prisma.vehicle.count({
      where: { branchId: branchId || undefined },
    }),
    prisma.book.count({
      where: { branchId: branchId || undefined },
    }),
  ]);

  // 7. Onboarding Telemetry Status
  const [academicYearsCount, subjectMastersCount, totalClassesCount, totalSectionsCount] = await Promise.all([
    prisma.academicYear.count({
      where: { organizationId: orgId },
    }),
    prisma.subjectMaster.count({
      where: { organizationId: orgId, isActive: true },
    }),
    prisma.class.count({
      where: { organizationId: orgId },
    }),
    prisma.section.count({
      where: { class: { organizationId: orgId } },
    }),
  ]);

  const onboardingSteps = {
    academicYear: academicYearsCount > 0,
    branch: branches > 0,
    subjectMaster: subjectMastersCount > 0,
    staff: staff > 0,
    class: totalClassesCount > 0,
    section: totalSectionsCount > 0,
  };

  const isOnboardingComplete =
    onboardingSteps.academicYear &&
    onboardingSteps.branch &&
    onboardingSteps.subjectMaster &&
    onboardingSteps.staff &&
    onboardingSteps.class &&
    onboardingSteps.section;

  return apiSuccess({
    stats: { students, staff, branches, users },
    attendance: attendanceSummary,
    financials: {
      totalInvoiced,
      totalCollected,
      outstandingBalance,
      collectionRate,
      recentPayments: formattedPayments,
    },
    notices: recentNotices,
    events: upcomingEvents,
    operations: {
      classes: classesCount,
      sections: sectionsCount,
      vehicles: vehiclesCount,
      books: booksCount,
    },
    onboarding: {
      isComplete: isOnboardingComplete,
      steps: onboardingSteps,
    },
  });
}
