import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiUnauthorized } from "@/lib/api-helpers";
import { getParentUser } from "../../../parent-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await getParentUser(req);
    if (!user || !user.parent) {
      return apiUnauthorized();
    }

    const { studentId } = await params;

    // Verify parent has access to this student
    const isAssociated = user.parent.children.some(
      (child) => child.studentId === studentId
    );
    
    if (!isAssociated) {
      return apiError("FORBIDDEN", "Access Denied: Student is not linked to this parent.", 403);
    }

    // 1. Fetch student meta
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          orderBy: { enrolledAt: "desc" },
          take: 1,
          include: {
            section: {
              include: {
                class: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return apiError("NOT_FOUND", "Student not found", 404);
    }

    const latestEnrollment = student.enrollments[0];
    const className = latestEnrollment?.section?.class?.name || "N/A";
    const sectionName = latestEnrollment?.section?.name || "N/A";
    const rollNo = student.rollNo || latestEnrollment?.rollNo || "N/A";

    // 2. Fetch Attendance
    const attendanceLogs = await prisma.studentAttendance.findMany({
      where: { studentId },
      orderBy: { date: "asc" },
    });

    const totalDays = attendanceLogs.length;
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let leaveDays = 0;

    const logsMapped = attendanceLogs.map((log) => {
      const dateStr = log.date.toISOString().split("T")[0];
      let status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" = "PRESENT";
      
      if (log.status === "PRESENT") {
        presentDays++;
        status = "PRESENT";
      } else if (log.status === "ABSENT") {
        absentDays++;
        status = "ABSENT";
      } else if (log.status === "LATE") {
        lateDays++;
        status = "LATE";
      } else if (log.status === "HALF_DAY" || log.status === "EXCUSED") {
        leaveDays++;
        status = "LEAVE";
      }
      
      return { date: dateStr, status };
    });

    const attendancePercentage = totalDays > 0 
      ? Math.round(((presentDays + lateDays) / totalDays) * 1000) / 10
      : 100.0;

    // 3. Fetch Invoices
    const invoices = await prisma.invoice.findMany({
      where: { studentId, organizationId: student.organizationId },
      include: {
        items: true,
      },
      orderBy: { dueDate: "desc" },
    });

    const invoicesMapped = invoices.map((inv) => {
      let status: "PAID" | "PARTIALLY_PAID" | "UNPAID" | "OVERDUE" = "UNPAID";
      
      if (inv.status === "PAID") status = "PAID";
      else if (inv.status === "PARTIAL") status = "PARTIALLY_PAID";
      else if (inv.status === "OVERDUE") status = "OVERDUE";
      else if (inv.status === "PENDING") status = "UNPAID";

      return {
        id: inv.id,
        invoiceNo: inv.number,
        title: inv.items.map((item) => item.description || "School Fee").join(", ") || "School Fee",
        dueDate: inv.dueDate.toISOString().split("T")[0],
        amount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        status,
      };
    });

    // 4. Fetch Marks & Exams
    const marks = await prisma.mark.findMany({
      where: { studentId },
      include: {
        examSubject: {
          include: {
            exam: true,
            subject: true,
          },
        },
      },
      orderBy: {
        examSubject: {
          exam: {
            startDate: "desc",
          },
        },
      },
    });

    // Group marks by Exam
    const examMap = new Map();
    marks.forEach((m) => {
      const exam = m.examSubject.exam;
      if (!examMap.has(exam.id)) {
        examMap.set(exam.id, {
          id: exam.id,
          name: exam.name,
          date: exam.startDate.toISOString().split("T")[0],
          subjects: [],
          totalMax: 0,
          totalObtained: 0,
          anyFail: false,
        });
      }

      const examRecord = examMap.get(exam.id);
      const marksObtained = m.marksObtained !== null ? Number(m.marksObtained) : 0;
      const maxMarks = m.examSubject.maxMarks;
      const passMarks = m.examSubject.passMarks;
      
      const grade = m.grade || (
        marksObtained / maxMarks >= 0.9 ? "A+" :
        marksObtained / maxMarks >= 0.8 ? "A" :
        marksObtained / maxMarks >= 0.7 ? "B+" :
        marksObtained / maxMarks >= 0.6 ? "B" :
        marksObtained / maxMarks >= 0.5 ? "C" : "D"
      );

      examRecord.subjects.push({
        subject: m.examSubject.subject.name,
        marksObtained,
        maxMarks,
        grade,
      });

      examRecord.totalMax += maxMarks;
      examRecord.totalObtained += marksObtained;
      if (marksObtained < passMarks) {
        examRecord.anyFail = true;
      }
    });

    const examsMapped = Array.from(examMap.values()).map((record) => {
      const percentage = record.totalMax > 0 
        ? Math.round((record.totalObtained / record.totalMax) * 1000) / 10
        : 0;
      
      let grade = "D";
      if (percentage >= 90) grade = "A+";
      else if (percentage >= 80) grade = "A";
      else if (percentage >= 70) grade = "B+";
      else if (percentage >= 60) grade = "B";
      else if (percentage >= 50) grade = "C";

      return {
        id: record.id,
        name: record.name,
        date: record.date,
        percentage,
        grade,
        result: record.anyFail ? "FAIL" : "PASS" as "PASS" | "FAIL",
        subjects: record.subjects,
      };
    });

    // 5. Notices for this branch targeting PARENT
    const notices = await prisma.notice.findMany({
      where: {
        OR: [
          { branchId: student.branchId },
          { branchId: null },
        ],
        isPublished: true,
        publishedAt: { lte: new Date() },
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        ]
      },
      orderBy: { publishedAt: "desc" },
    });

    const noticesMapped = notices.filter((n) => {
      try {
        const roles = n.targetRoles;
        if (Array.isArray(roles)) return roles.includes("PARENT");
        if (typeof roles === "string") return JSON.parse(roles).includes("PARENT");
      } catch {
        return false;
      }
      return false;
    }).map((n) => {
      let category: "ACADEMIC" | "FEES" | "EVENT" | "HOLIDAY" | "URGENT" = "EVENT";
      const titleLower = n.title.toLowerCase();
      
      if (titleLower.includes("exam") || titleLower.includes("reopening") || titleLower.includes("academic") || titleLower.includes("timetable")) {
        category = "ACADEMIC";
      } else if (titleLower.includes("fee") || titleLower.includes("outstanding") || titleLower.includes("payment")) {
        category = "FEES";
      } else if (titleLower.includes("sports") || titleLower.includes("meet") || titleLower.includes("prize")) {
        category = "EVENT";
      } else if (titleLower.includes("holiday") || titleLower.includes("closed")) {
        category = "HOLIDAY";
      }

      return {
        id: n.id,
        title: n.title,
        description: n.content,
        date: (n.publishedAt || n.createdAt).toISOString().split("T")[0],
        category,
        author: n.createdBy || "Administration",
      };
    });

    const studentProfile = {
      id: student.id,
      admissionNo: student.admissionNo,
      rollNo,
      firstName: student.firstName,
      lastName: student.lastName,
      class: className,
      section: sectionName,
      gender: student.gender,
      photo: null,
      bloodGroup: student.bloodGroup || "N/A",
      attendance: {
        percentage: attendancePercentage,
        presentDays,
        absentDays,
        lateDays,
        leaveDays,
        logs: logsMapped,
      },
      exams: examsMapped,
      invoices: invoicesMapped,
    };

    return apiSuccess({
      student: studentProfile,
      notices: noticesMapped,
    });
  } catch (error: any) {
    console.error("Student dashboard error:", error);
    return apiError("SERVER_ERROR", "Internal server error: " + error.message, 500);
  }
}
