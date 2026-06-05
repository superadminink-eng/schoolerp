import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import crypto from "crypto";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admissions/applications/[id]/promote — Promote shortlisted candidate to active student
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "admissions", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const {
    sectionId,
    rollNo,
    admissionDate,
    discountPercent,
    amountPaid,
    paymentMethod,
    transactionId,
  } = body as {
    sectionId: string;
    rollNo?: string;
    admissionDate?: string;
    discountPercent?: number;
    amountPaid?: number;
    paymentMethod?: "CASH" | "ONLINE" | "CHEQUE" | "BANK_TRANSFER" | "UPI";
    transactionId?: string;
  };

  if (!sectionId) {
    return apiError("BAD_REQUEST", "Missing required field: sectionId", 400);
  }

  try {
    // 1. Verify application exists and belongs to organization/branch scope
    const application = await prisma.admissionApplication.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        ...(ctx.roleName === "BRANCH_ADMIN" && ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
      include: {
        documents: true,
      },
    });

    if (!application) {
      return apiError("NOT_FOUND", "Application not found in current scope", 404);
    }

    if (application.status === "ADMITTED") {
      return apiError("CONFLICT", "Candidate has already been admitted", 409);
    }

    // 2. Verify section exists and links to the correct class/branch
    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        class: {
          id: application.classId,
          branchId: application.branchId,
        },
      },
      include: {
        class: true,
      },
    });

    if (!section) {
      return apiError("NOT_FOUND", "Selected class section not found", 404);
    }

    // 3. Promote candidate in a database transaction
    const student = await prisma.$transaction(async (tx) => {
      // Create student admission number
      const admissionNo = `ADM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      // Create official Student record
      const studentRecord = await tx.student.create({
        data: {
          branchId: application.branchId,
          admissionNo,
          rollNo: rollNo || null,
          firstName: application.firstName,
          lastName: application.lastName,
          dateOfBirth: application.dateOfBirth,
          gender: application.gender,
          bloodGroup: application.bloodGroup,
          photo: application.photo,
          address: application.address,
          pincode: application.pincode,
          previousSchool: application.previousSchool,
          emergencyContact1: application.emergencyContact,
          fatherName: application.fatherName,
          fatherPhone: application.fatherPhone,
          fatherEmail: application.fatherEmail,
          fatherOccupation: application.fatherOccupation,
          motherName: application.motherName,
          motherPhone: application.motherPhone,
          motherEmail: application.motherEmail,
          motherOccupation: application.motherOccupation,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          status: "ACTIVE",
        },
      });

      // Create official Enrollment record
      await tx.studentEnrollment.create({
        data: {
          studentId: studentRecord.id,
          academicYearId: application.academicYearId,
          sectionId,
          rollNo: rollNo || null,
        },
      });

      // Calculate and generate invoices if fee structures exist for this class
      const feeStructures = await tx.feeStructure.findMany({
        where: { classId: application.classId },
        include: { feeCategory: { select: { name: true } } },
      });

      if (feeStructures.length > 0) {
        const feeItems = feeStructures.map((fs) => {
          const base = Number(fs.amount);
          let annual: number;
          switch (fs.frequency) {
            case "MONTHLY":
              annual = base * 12;
              break;
            case "QUARTERLY":
              annual = base * 4;
              break;
            case "SEMI_ANNUAL":
              annual = base * 2;
              break;
            default:
              annual = base;
          }
          return { feeStructureId: fs.id, name: fs.feeCategory.name, annual };
        });

        const annualTotal = feeItems.reduce((s, f) => s + f.annual, 0);
        const discountPct = discountPercent ?? 0;
        const discountedTotal = annualTotal * (1 - discountPct / 100);
        const paid = Math.min(amountPaid ?? 0, discountedTotal);

        let invoiceStatus: "PENDING" | "PARTIAL" | "PAID" = "PENDING";
        if (paid > 0 && paid >= discountedTotal) {
          invoiceStatus = "PAID";
        } else if (paid > 0) {
          invoiceStatus = "PARTIAL";
        }

        const invoiceNo = `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const invoice = await tx.invoice.create({
          data: {
            studentId: studentRecord.id,
            number: invoiceNo,
            year: new Date().getFullYear(),
            totalAmount: discountedTotal,
            paidAmount: paid,
            status: invoiceStatus,
            dueDate,
            items: {
              create: feeItems.map((fi) => {
                const itemDiscounted = fi.annual * (1 - discountPct / 100);
                return {
                  feeStructureId: fi.feeStructureId,
                  amount: itemDiscounted,
                  description: fi.name,
                };
              }),
            },
          },
        });

        // Log Payment if amountPaid > 0
        if (paid > 0 && paymentMethod) {
          const receiptNo = `RCP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
          await tx.feePayment.create({
            data: {
              invoiceId: invoice.id,
              studentId: studentRecord.id,
              amount: paid,
              method: paymentMethod,
              transactionId: transactionId || null,
              receiptNo,
            },
          });
        }
      }

      // Update application status to ADMITTED
      await tx.admissionApplication.update({
        where: { id },
        data: { status: "ADMITTED" },
      });

      return studentRecord;
    }, { timeout: 30000 });

    return apiSuccess(student, undefined, 201);
  } catch (error) {
    console.error("Promote candidate error:", error);
    return apiError("INTERNAL_ERROR", "Failed to promote candidate to student", 500);
  }
}
