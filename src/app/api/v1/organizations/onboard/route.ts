import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-helpers";
import { getTenantContext } from "@/lib/rbac";
import { saveUploadedImage, UploadError } from "@/lib/upload";
import { logAction } from "@/lib/audit";
import { z } from "zod";

const onboardSchema = z.object({
  schoolName: z.string().min(2, "School name must be at least 2 characters").max(200),
  schoolPhone: z.string().optional().nullable(),
  schoolAddress: z.string().optional().nullable(),
  schoolWebsite: z.string().optional().nullable(),
  branchName: z.string().min(2, "Branch name must be at least 2 characters").max(200),
  branchCode: z.string().min(2, "Branch code must be at least 2 characters").max(20),
  branchPhone: z.string().optional().nullable(),
  branchAddress: z.string().optional().nullable(),
  academicYearName: z.string().min(2, "Academic year name is required").max(50),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid start date",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid end date",
  }),
});

/**
 * POST /api/v1/organizations/onboard — Complete the setup wizard for a new organization.
 * Updates school details, main branch settings, and creates the first academic year in a transaction.
 */
export async function POST(req: NextRequest) {
  const ctx = getTenantContext(req);

  if (!ctx.organizationId || !ctx.userId) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }

  if (ctx.roleName !== "SCHOOL_ADMIN") {
    return apiError("FORBIDDEN", "Only school administrators can perform onboarding", 403);
  }

  try {
    const formData = await req.formData();
    
    // Parse fields
    const fields: Record<string, any> = {};
    for (const key of onboardSchema.keyof().options) {
      const value = formData.get(key);
      if (value !== null) {
        fields[key] = value === "null" || value === "" ? null : value;
      }
    }

    const parsed = onboardSchema.safeParse(fields);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    const {
      schoolName,
      schoolPhone,
      schoolAddress,
      schoolWebsite,
      branchName,
      branchCode,
      branchPhone,
      branchAddress,
      academicYearName,
      startDate,
      endDate,
    } = parsed.data;

    // Handle optional logo upload
    const logoFile = formData.get("logo") as File | null;
    let logoPath: string | null = null;
    if (logoFile && logoFile.size > 0) {
      try {
        const uploadResult = await saveUploadedImage(
          logoFile,
          "uploads/org-logos",
          ctx.organizationId,
          "photo"
        );
        logoPath = uploadResult.filePath;
      } catch (err: any) {
        if (err instanceof UploadError) {
          return apiError("BAD_REQUEST", err.message, 400);
        }
        console.error("Logo upload error:", err);
        return apiError("INTERNAL_ERROR", `Failed to upload logo image: ${err.message || err}`, 500);
      }
    }

    // 1. Find the Main Branch of this organization first
    const mainBranch = await prisma.branch.findFirst({
      where: { organizationId: ctx.organizationId, isMain: true },
    });

    if (!mainBranch) {
      return apiError("NOT_FOUND", "Main branch not found for organization. Please contact support.", 404);
    }

    // 2. Check if the branchCode is already taken by ANOTHER branch in this organization
    const duplicateBranch = await prisma.branch.findFirst({
      where: {
        organizationId: ctx.organizationId,
        code: branchCode.toUpperCase(),
        id: { not: mainBranch.id },
      },
    });

    if (duplicateBranch) {
      return apiError(
        "BAD_REQUEST",
        `Branch code "${branchCode.toUpperCase()}" is already in use by another branch. Please choose a different code.`,
        400
      );
    }

    // Execute setup inside a database transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update Organization details
      const updateData: Record<string, any> = {
        name: schoolName,
        phone: schoolPhone,
        address: schoolAddress,
        website: schoolWebsite,
        isSetupComplete: true,
      };
      if (logoPath) {
        updateData.logo = logoPath;
      }
      
      await tx.organization.update({
        where: { id: ctx.organizationId },
        data: updateData,
      });

      // 2. Update the Main Branch
      await tx.branch.update({
        where: { id: mainBranch.id },
        data: {
          name: branchName,
          code: branchCode.toUpperCase(),
          phone: branchPhone,
          address: branchAddress,
        },
      });

      // 3. Create or Update the AcademicYear record
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);

      const existingYear = await tx.academicYear.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: academicYearName,
        },
      });

      if (existingYear) {
        await tx.academicYear.update({
          where: { id: existingYear.id },
          data: {
            startDate: startDateTime,
            endDate: endDateTime,
            isCurrent: true,
          },
        });
      } else {
        await tx.academicYear.create({
          data: {
            organizationId: ctx.organizationId,
            name: academicYearName,
            startDate: startDateTime,
            endDate: endDateTime,
            isCurrent: true,
          },
        });
      }

      // 4. Ensure all other academic years of this organization are set to isCurrent = false
      await tx.academicYear.updateMany({
        where: {
          organizationId: ctx.organizationId,
          name: { not: academicYearName },
        },
        data: {
          isCurrent: false,
        },
      });
    }, { timeout: 15000 });

    // 5. Log audit action outside transaction to prevent connection lockups/deadlocks
    await logAction({
      organizationId: ctx.organizationId,
      branchId: mainBranch.id,
      userId: ctx.userId,
      action: "ONBOARD",
      module: "ORGANIZATIONS",
      entityId: ctx.organizationId,
      details: { schoolName, branchCode },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Onboarding API error:", error);
    return apiError("INTERNAL_ERROR", "Failed to complete school setup wizard", 500);
  }
}
