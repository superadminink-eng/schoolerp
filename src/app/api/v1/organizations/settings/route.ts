import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-helpers";
import { getTenantContext } from "@/lib/rbac";
import { saveUploadedImage, deleteUploadedFile, UploadError } from "@/lib/upload";
import { logAction } from "@/lib/audit";
import { z } from "zod";

const settingsSchema = z.object({
  // School profile
  name: z.string().min(2, "School name must be at least 2 characters").max(200),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().optional().nullable(),

  // Main branch settings
  branchName: z.string().min(2, "Branch name must be at least 2 characters").max(200),
  branchCode: z.string().min(2, "Branch code must be at least 2 characters").max(20),
  branchPhone: z.string().optional().nullable(),
  branchAddress: z.string().optional().nullable(),

  // Academic year settings
  academicYearName: z.string().min(2, "Academic year name is required").max(50),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid start date",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid end date",
  }),
});

/**
 * GET /api/v1/organizations/settings — Fetch settings for organization, main branch, and academic year
 */
export async function GET(req: NextRequest) {
  const ctx = getTenantContext(req);

  if (!ctx.organizationId || !ctx.userId) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }

  if (ctx.roleName !== "SCHOOL_ADMIN" && ctx.roleName !== "SUPER_ADMIN") {
    return apiError("FORBIDDEN", "Only school administrators can access settings", 403);
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        email: true,
        phone: true,
        address: true,
        website: true,
        plan: true,
      },
    });

    if (!org) {
      return apiError("NOT_FOUND", "Organization not found", 404);
    }

    const mainBranch = await prisma.branch.findFirst({
      where: { organizationId: ctx.organizationId, isMain: true },
      select: {
        id: true,
        name: true,
        code: true,
        phone: true,
        address: true,
      },
    });

    const academicYear = await prisma.academicYear.findFirst({
      where: { organizationId: ctx.organizationId, isCurrent: true },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    return apiSuccess({
      organization: org,
      mainBranch,
      academicYear,
    });
  } catch (error) {
    console.error("Fetch settings error:", error);
    return apiError("INTERNAL_ERROR", "Failed to retrieve school settings", 500);
  }
}

/**
 * POST /api/v1/organizations/settings — Update settings for organization, main branch, and academic year
 */
export async function POST(req: NextRequest) {
  const ctx = getTenantContext(req);

  if (!ctx.organizationId || !ctx.userId) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }

  if (ctx.roleName !== "SCHOOL_ADMIN" && ctx.roleName !== "SUPER_ADMIN") {
    return apiError("FORBIDDEN", "Only school administrators can modify settings", 403);
  }

  try {
    const formData = await req.formData();

    // Parse fields
    const fields: Record<string, any> = {};
    for (const key of settingsSchema.keyof().options) {
      const value = formData.get(key);
      if (value !== null) {
        fields[key] = value === "null" || value === "" ? null : value;
      }
    }

    const parsed = settingsSchema.safeParse(fields);
    if (!parsed.success) {
      return apiValidationError(parsed.error);
    }

    const {
      name, phone, address, website,
      branchName, branchCode, branchPhone, branchAddress,
      academicYearName, startDate, endDate
    } = parsed.data;

    // 1. Find the Main Branch first
    const mainBranch = await prisma.branch.findFirst({
      where: { organizationId: ctx.organizationId, isMain: true },
    });

    if (!mainBranch) {
      return apiError("NOT_FOUND", "Main branch not found for organization", 404);
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
        `Branch code "${branchCode.toUpperCase()}" is already in use by another branch.`,
        400
      );
    }

    // Query current organization logo to clean up files if updated/removed
    const existingOrg = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { logo: true },
    });
    const oldLogo = existingOrg?.logo;

    // Handle logo image upload
    const logoFile = formData.get("logo") as File | null;
    let logoPath: string | null = null;
    let removeLogo = formData.get("removeLogo") === "true";

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

    // Clean up old logo file if a new one is uploaded or old one is removed
    if (oldLogo && (logoPath || removeLogo)) {
      await deleteUploadedFile(oldLogo);
    }

    let updatedOrg;
    let updatedBranch;
    let updatedYear;

    // Execute updates inside database transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update Organization
      const updateData: Record<string, any> = {
        name,
        phone,
        address,
        website,
      };
      if (logoPath) {
        updateData.logo = logoPath;
      } else if (removeLogo) {
        updateData.logo = null;
      }

      updatedOrg = await tx.organization.update({
        where: { id: ctx.organizationId },
        data: updateData,
      });

      // 2. Update Main Branch
      updatedBranch = await tx.branch.update({
        where: { id: mainBranch.id },
        data: {
          name: branchName,
          code: branchCode.toUpperCase(),
          phone: branchPhone,
          address: branchAddress,
        },
      });

      // 3. Upsert current AcademicYear
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);

      const existingYear = await tx.academicYear.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: academicYearName,
        },
      });

      if (existingYear) {
        updatedYear = await tx.academicYear.update({
          where: { id: existingYear.id },
          data: {
            startDate: startDateTime,
            endDate: endDateTime,
            isCurrent: true,
          },
        });
      } else {
        updatedYear = await tx.academicYear.create({
          data: {
            organizationId: ctx.organizationId,
            name: academicYearName,
            startDate: startDateTime,
            endDate: endDateTime,
            isCurrent: true,
          },
        });
      }

      // Ensure other academic years of this organization are set to isCurrent = false
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

    // 4. Log audit action outside transaction
    await logAction({
      organizationId: ctx.organizationId,
      branchId: mainBranch.id,
      userId: ctx.userId,
      action: "UPDATE",
      module: "ORGANIZATIONS",
      entityId: ctx.organizationId,
      details: {
        updatedFields: ["organization", "mainBranch", "academicYear"],
      },
    });

    return apiSuccess({
      organization: updatedOrg,
      mainBranch: updatedBranch,
      academicYear: updatedYear,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update school settings", 500);
  }
}
