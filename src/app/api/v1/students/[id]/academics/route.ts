import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

type RouteContext = any;

/**
 * GET /api/v1/students/[id]/academics — Retrieve academic records (exams & marks) for a student
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

    // 2. Fetch marks for this student
    const marks = await prisma.mark.findMany({
      where: { studentId: id },
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
          date: "desc",
        },
      },
    });

    // 3. Process aggregates and group by Exam
    let totalScore = 0;
    let maxPossibleScore = 0;
    let passCount = 0;
    let totalSubjectsMarked = 0;

    const examGroups: Record<string, {
      examId: string;
      examName: string;
      examType: string;
      startDate: Date;
      endDate: Date;
      subjects: Array<{
        subjectName: string;
        subjectCode: string;
        maxMarks: number;
        passMarks: number;
        marksObtained: number | null;
        isAbsent: boolean;
        status: "PASS" | "FAIL" | "ABSENT";
        grade: string | null;
        remarks: string | null;
      }>;
    }> = {};

    for (const m of marks) {
      const exam = m.examSubject.exam;
      const sub = m.examSubject.subject;
      const obtained = m.marksObtained ? Number(m.marksObtained) : null;
      const max = m.examSubject.maxMarks;
      const pass = m.examSubject.passMarks;

      let status: "PASS" | "FAIL" | "ABSENT" = "FAIL";
      if (m.isAbsent) {
        status = "ABSENT";
      } else if (obtained !== null) {
        status = obtained >= pass ? "PASS" : "FAIL";
        totalScore += obtained;
        maxPossibleScore += max;
        totalSubjectsMarked++;
        if (obtained >= pass) {
          passCount++;
        }
      }

      if (!examGroups[exam.id]) {
        examGroups[exam.id] = {
          examId: exam.id,
          examName: exam.name,
          examType: exam.type,
          startDate: exam.startDate,
          endDate: exam.endDate,
          subjects: [],
        };
      }

      examGroups[exam.id].subjects.push({
        subjectName: sub.name,
        subjectCode: sub.code,
        maxMarks: max,
        passMarks: pass,
        marksObtained: obtained,
        isAbsent: m.isAbsent,
        status,
        grade: m.grade,
        remarks: m.remarks,
      });
    }

    const examsList = Object.values(examGroups).sort(
      (a, b) => b.startDate.getTime() - a.startDate.getTime()
    );

    const averageScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    const passRate = totalSubjectsMarked > 0 ? (passCount / totalSubjectsMarked) * 100 : 0;

    return apiSuccess({
      averageScore: Number(averageScore.toFixed(1)),
      passRate: Number(passRate.toFixed(1)),
      totalExams: examsList.length,
      exams: examsList,
    });
  } catch (error) {
    console.error("Get student academics error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load academic records", 500);
  }
}
