import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const issueLcSchema = z.object({
  leavingDate: z.string().transform((val) => new Date(val)),
  reasonForLeaving: z.string().min(1, "Reason is required"),
  conduct: z.string().default("Good"),
  remarks: z.string().optional(),
  signatoryName: z.string().optional(),
  signatoryTitle: z.string().optional(),
  status: z.enum(["TRANSFERRED", "GRADUATED", "DROPPED"]).default("TRANSFERRED"),
  allowOverride: z.boolean().default(false),
});

/**
 * GET /api/v1/students/[id]/issue-lc — Retrieve leaving certificate details for a student if issued
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "students", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  try {
    const student = await prisma.student.findFirst({
      where: {
        id,
        branch: { organizationId: ctx.organizationId },
        ...(ctx.roleName === "BRANCH_ADMIN" && ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    });

    if (!student) return apiNotFound("Student");

    const lc = await prisma.leavingCertificate.findUnique({
      where: { studentId: id },
    });

    if (!lc) return apiNotFound("Leaving Certificate");

    return apiSuccess(lc);
  } catch (error) {
    console.error("Get LC error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve leaving certificate", 500);
  }
}

/**
 * POST /api/v1/students/[id]/issue-lc — Issue a leaving certificate for a student
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "students", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  try {
    // 1. Verify student exists in this tenant organization
    const student = await prisma.student.findFirst({
      where: {
        id,
        branch: { organizationId: ctx.organizationId },
        ...(ctx.roleName === "BRANCH_ADMIN" && ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    });

    if (!student) return apiNotFound("Student");

    // 2. Parse request body
    const body = await req.json();
    const parsed = issueLcSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const {
      leavingDate,
      reasonForLeaving,
      conduct,
      remarks,
      signatoryName,
      signatoryTitle,
      status,
      allowOverride,
    } = parsed.data;

    // 3. Check for pending dues
    if (!allowOverride) {
      const invoiceAgg = await prisma.invoice.aggregate({
        where: { studentId: id, status: { notIn: ["CANCELLED", "PAID"] } },
        _sum: { totalAmount: true, paidAmount: true },
      });

      const totalFees = Number(invoiceAgg._sum.totalAmount ?? 0);
      const totalPaid = Number(invoiceAgg._sum.paidAmount ?? 0);
      const pendingAmount = totalFees - totalPaid;

      if (pendingAmount > 0) {
        return apiError(
          "PENDING_DUES",
          `Outstanding fees of ₹${pendingAmount} must be settled before issuing leaving certificate.`,
          400,
          { pendingAmount }
        );
      }
    }

    // 4. Generate certificate number: LC/BRANCH_CODE/YEAR/ADMISSION_NO
    const branch = await prisma.branch.findUnique({
      where: { id: student.branchId },
      select: { code: true },
    });
    const branchCode = branch?.code || "BR";
    const year = new Date(leavingDate).getFullYear();
    const certificateNo = `LC/${branchCode}/${year}/${student.admissionNo}`;

    // 5. Check if certificate number is already generated (rare, but in case student already has one)
    const existingLc = await prisma.leavingCertificate.findFirst({
      where: {
        OR: [
          { studentId: id },
          { certificateNo },
        ],
      },
    });

    if (existingLc) {
      return apiError(
        "ALREADY_ISSUED",
        "A leaving certificate is already issued for this student or certificate number already exists.",
        400
      );
    }

    // 6. Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create LC
      const lc = await tx.leavingCertificate.create({
        data: {
          studentId: id,
          certificateNo,
          leavingDate,
          reasonForLeaving,
          conduct,
          remarks,
          signatoryName,
          signatoryTitle,
        },
      });

      // Update Student Status
      await tx.student.update({
        where: { id },
        data: {
          status,
          leavingDate,
          leavingReason: reasonForLeaving,
        },
      });

      return lc;
    });

    return apiSuccess(result, undefined, 201);
  } catch (error) {
    console.error("Issue LC error:", error);
    return apiError("INTERNAL_ERROR", "Failed to issue leaving certificate", 500);
  }
}
