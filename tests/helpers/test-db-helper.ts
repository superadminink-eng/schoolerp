import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface TestContext {
  organizationId: string;
  branchId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  studentId?: string;
  invoiceId?: string;
  paymentId?: string;
  subjectId?: string;
  examId?: string;
  examSubjectId?: string;
}

export class TestDbHelper {
  private createdStudentIds: string[] = [];
  private createdInvoiceIds: string[] = [];
  private createdPaymentIds: string[] = [];
  private createdSectionIds: string[] = [];
  private createdClassIds: string[] = [];
  private createdAcademicYearIds: string[] = [];
  private createdSubjectIds: string[] = [];
  private createdExamIds: string[] = [];
  private createdExamSubjectIds: string[] = [];
  private createdMarkIds: string[] = [];

  /**
   * Generates a unique 6-character suffix to isolate test names.
   */
  static generateSuffix(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Automatically sets up a complete class, section, and academic year hierarchy.
   */
  async setupAcademics(suffix: string): Promise<TestContext> {
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No organization found. Please run baseline database seed.");

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } });
    if (!branch) throw new Error("No branch found.");

    const academicYear = await prisma.academicYear.create({
      data: {
        organizationId: org.id,
        name: `AY-${suffix}`,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2027-04-30"),
        isCurrent: false,
      },
    });
    this.createdAcademicYearIds.push(academicYear.id);

    const classRecord = await prisma.class.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        academicYearId: academicYear.id,
        name: `Class-${suffix}`,
        numericGrade: Math.floor(Math.random() * 10) + 1,
        status: "ACTIVE",
      },
    });
    this.createdClassIds.push(classRecord.id);

    const section = await prisma.section.create({
      data: {
        classId: classRecord.id,
        name: `Sec-${suffix}`,
      },
    });
    this.createdSectionIds.push(section.id);

    return {
      organizationId: org.id,
      branchId: branch.id,
      academicYearId: academicYear.id,
      classId: classRecord.id,
      sectionId: section.id,
    };
  }

  /**
   * Seeds an isolated test student linked to the academics context.
   */
  async seedStudent(context: TestContext, suffix: string) {
    const student = await prisma.student.create({
      data: {
        organizationId: context.organizationId,
        branchId: context.branchId,
        admissionNo: `ADM-T-${suffix}`,
        firstName: `Rajesh-${suffix}`,
        lastName: "Kumar",
        dateOfBirth: new Date("2015-08-15"),
        gender: "MALE",
        emergencyContact1: "9876543210",
        idType: "Aadhaar",
        idNumber: `ID-${suffix}`,
        fatherName: "Suresh Kumar",
        fatherPhone: "9876543211",
        motherName: "Sunita Kumar",
        category: "GENERAL",
        status: "ACTIVE",
        enrollments: {
          create: {
            academicYearId: context.academicYearId,
            sectionId: context.sectionId,
            rollNo: Math.floor(Math.random() * 100).toString(),
          },
        },
      },
    });
    this.createdStudentIds.push(student.id);
    context.studentId = student.id;
    return student;
  }

  /**
   * Seeds a test subject, exam, and marks for a student.
   */
  async seedMarks(context: TestContext, suffix: string) {
    if (!context.studentId) throw new Error("Student ID must be seeded before seeding marks");

    const subject = await prisma.subject.create({
      data: {
        classId: context.classId,
        name: `Subject-${suffix}`,
        code: `SUB-${suffix}`,
        type: "THEORY",
      },
    });
    this.createdSubjectIds.push(subject.id);
    context.subjectId = subject.id;

    const exam = await prisma.exam.create({
      data: {
        academicYearId: context.academicYearId,
        name: `Exam-${suffix}`,
        type: "FINAL",
        startDate: new Date(),
        endDate: new Date(),
      },
    });
    this.createdExamIds.push(exam.id);
    context.examId = exam.id;

    const examSubject = await prisma.examSubject.create({
      data: {
        examId: exam.id,
        subjectId: subject.id,
        date: new Date(),
        startTime: "09:00",
        endTime: "12:00",
        maxMarks: 100,
        passMarks: 35,
      },
    });
    this.createdExamSubjectIds.push(examSubject.id);
    context.examSubjectId = examSubject.id;

    const mark = await prisma.mark.create({
      data: {
        examSubjectId: examSubject.id,
        studentId: context.studentId,
        marksObtained: 85.0,
        grade: "A",
        remarks: "Excellent performance",
        gradedBy: "Test Grader",
      },
    });
    this.createdMarkIds.push(mark.id);
  }

  /**
   * Seeds an isolated invoice and payment.
   */
  async seedInvoice(context: TestContext, suffix: string, totalAmount = 5000, paidAmount = 3000) {
    if (!context.studentId) throw new Error("Student ID must be seeded before seeding invoice");

    const invoice = await prisma.invoice.create({
      data: {
        studentId: context.studentId,
        organizationId: context.organizationId,
        number: `INV-T-${suffix}`,
        year: 2026,
        totalAmount,
        paidAmount,
        status: paidAmount >= totalAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING",
        dueDate: new Date("2026-06-30"),
      },
    });
    this.createdInvoiceIds.push(invoice.id);
    context.invoiceId = invoice.id;

    if (paidAmount > 0) {
      const payment = await prisma.feePayment.create({
        data: {
          invoiceId: invoice.id,
          studentId: context.studentId,
          organizationId: context.organizationId,
          amount: paidAmount,
          method: "UPI",
          receiptNo: `REC-T-${suffix}`,
          paidAt: new Date(),
          remarks: "Test payment",
        },
      });
      this.createdPaymentIds.push(payment.id);
      context.paymentId = payment.id;
    }

    return invoice;
  }

  /**
   * Completely cleans up all database records created during the test instance.
   */
  async cleanup() {
    try {
      // 1. Delete marks
      if (this.createdMarkIds.length > 0) {
        await prisma.mark.deleteMany({ where: { id: { in: this.createdMarkIds } } });
      }
      // 2. Delete payments
      if (this.createdPaymentIds.length > 0) {
        await prisma.feePayment.deleteMany({ where: { id: { in: this.createdPaymentIds } } });
      }
      // 3. Delete invoice items
      if (this.createdInvoiceIds.length > 0) {
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: this.createdInvoiceIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: this.createdInvoiceIds } } });
      }
      // 4. Delete student parent / enrollments
      if (this.createdStudentIds.length > 0) {
        await prisma.studentEnrollment.deleteMany({ where: { studentId: { in: this.createdStudentIds } } });
        await prisma.studentParent.deleteMany({ where: { studentId: { in: this.createdStudentIds } } });
        await prisma.student.deleteMany({ where: { id: { in: this.createdStudentIds } } });
      }
      // 5. Delete exam subject mappings / subjects / exams
      if (this.createdExamSubjectIds.length > 0) {
        await prisma.examSubject.deleteMany({ where: { id: { in: this.createdExamSubjectIds } } });
      }
      if (this.createdSubjectIds.length > 0) {
        await prisma.subject.deleteMany({ where: { id: { in: this.createdSubjectIds } } });
      }
      if (this.createdExamIds.length > 0) {
        await prisma.exam.deleteMany({ where: { id: { in: this.createdExamIds } } });
      }
      // 6. Delete sections / classes / academic years
      if (this.createdSectionIds.length > 0) {
        await prisma.section.deleteMany({ where: { id: { in: this.createdSectionIds } } });
      }
      if (this.createdClassIds.length > 0) {
        await prisma.class.deleteMany({ where: { id: { in: this.createdClassIds } } });
      }
      if (this.createdAcademicYearIds.length > 0) {
        await prisma.academicYear.deleteMany({ where: { id: { in: this.createdAcademicYearIds } } });
      }
    } catch (error) {
      console.error("Cleanup error in TestDbHelper:", error);
    } finally {
      await prisma.$disconnect();
    }
  }
}
