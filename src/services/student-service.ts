import { prisma } from "@/lib/prisma";
import { CreateStudentInput } from "@/lib/validations/student";
import { saveUploadedImage } from "@/lib/upload";
import { generateUniqueAdmissionNo } from "@/lib/unique-id";
import { logAction } from "@/lib/audit";
import { FeeService, TenantContext } from "./fee-service";

export class StudentService {
  /**
   * Creates a student, dynamic academic enrollment, and initial invoice/payment in a safe database transaction.
   */
  static async createStudent(
    data: CreateStudentInput & {
      discountPercent?: string;
      amountPaid?: string;
      paymentMethod?: string;
      transactionId?: string;
      discountAmount?: string;
      optionalFeeIds?: string[];
      customInstallments?: any[];
    },
    files: { photo?: File | null; idDocument?: File | null },
    ctx: TenantContext
  ) {
    // Verify branch belongs to organization
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!branch) {
      throw new Error("BRANCH_NOT_FOUND");
    }

    // Verify section exists and belongs to correct branch
    let section: any = null;
    if (data.sectionId) {
      section = await prisma.section.findFirst({
        where: { id: data.sectionId },
        include: {
          class: {
            include: { academicYear: true },
          },
        },
      });
      if (!section || section.class.branchId !== data.branchId) {
        throw new Error("SECTION_NOT_FOUND");
      }
    }

    // Verify class exists and belongs to correct branch/organization
    if (data.classId) {
      const cls = await prisma.class.findFirst({
        where: { id: data.classId, branchId: data.branchId, status: "ACTIVE" },
      });
      if (!cls) {
        throw new Error("CLASS_NOT_FOUND");
      }
    }

    // Generate atomic admission number
    const admissionNo = await generateUniqueAdmissionNo(prisma, ctx.organizationId);

    // Save uploaded files
    let photoPath: string | null = null;
    if (files.photo) {
      const uploadRes = await saveUploadedImage(files.photo, "uploads/student-photos", admissionNo, "photo");
      photoPath = uploadRes.filePath;
    }

    let idDocumentPath: string | null = null;
    if (files.idDocument) {
      const uploadRes = await saveUploadedImage(files.idDocument, "uploads/student-documents", admissionNo);
      idDocumentPath = uploadRes.filePath;
    }

    // DB Transaction
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          branchId: data.branchId,
          organizationId: ctx.organizationId,
          admissionNo,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          bloodGroup: data.bloodGroup || null,
          photo: photoPath,
          address: data.address,
          pincode: data.pincode,
          previousSchool: data.previousSchool || null,
          emergencyContact1: data.emergencyContact1,
          emergencyContact2: data.emergencyContact2 || null,
          idType: data.idType || null,
          idNumber: data.idNumber || null,
          idDocument: idDocumentPath,
          guardianName: data.guardianName || null,
          fatherName: data.fatherName || null,
          fatherPhone: data.fatherPhone || null,
          fatherEmail: data.fatherEmail || null,
          fatherOccupation: data.fatherOccupation || null,
          motherName: data.motherName || null,
          motherPhone: data.motherPhone || null,
          motherEmail: data.motherEmail || null,
          motherOccupation: data.motherOccupation || null,
          admissionDate: data.admissionDate ? new Date(data.admissionDate) : new Date(),
          house: data.house || null,
          category: data.category,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNo: true,
          gender: true,
          status: true,
          admissionDate: true,
          branch: { select: { id: true, name: true } },
        },
      });

      // Create enrollment
      if (section && data.sectionId) {
        await tx.studentEnrollment.create({
          data: {
            studentId: created.id,
            academicYearId: section.class.academicYearId,
            sectionId: data.sectionId,
          },
        });
      }

      // Delegate initial invoice and payment generation to FeeService
      if (data.classId) {
        await FeeService.createInitialInvoice(tx, created.id, ctx.organizationId, {
          classId: data.classId,
          discountPercent: data.discountPercent ? parseFloat(data.discountPercent) : 0,
          discountAmount: data.discountAmount ? parseFloat(data.discountAmount) : 0,
          optionalFeeIds: data.optionalFeeIds || [],
          customInstallments: data.customInstallments || [],
          amountPaid: data.amountPaid ? parseFloat(data.amountPaid) : 0,
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId,
        });
      }

      return created;
    }, { timeout: 30000 });

    // Write audit log
    await logAction({
      organizationId: ctx.organizationId,
      branchId: student.branch.id,
      userId: ctx.userId,
      action: "CREATE",
      module: "students",
      entityId: student.id,
      details: { admissionNo: student.admissionNo, name: `${student.firstName} ${student.lastName}` },
    });

    return student;
  }
}
