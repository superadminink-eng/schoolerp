import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateFeeCategorySchema } from "@/lib/validations/fee-category";
import { getTenantContext } from "@/lib/rbac";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  try {
    const ctx = getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const category = await prisma.feeCategory.findUnique({
      where: {
        id: resolvedParams.id,
        organizationId: ctx.organizationId,
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Fee category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: category });
  } catch (error: any) {
    console.error("FeeCategory GET [id] Error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch fee category", details: error.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  try {
    const ctx = getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = resolvedParams;
    const body = await req.json();
    const parsed = updateFeeCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Validation failed", details: parsed.error.format() } },
        { status: 400 }
      );
    }

    const { name, code, description, isActive } = parsed.data;

    const existing = await prisma.feeCategory.findUnique({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Fee category not found" }, { status: 404 });
    }

    // Check unique code if it's changing
    if (code && code !== existing.code) {
      const duplicateCode = await prisma.feeCategory.findFirst({
        where: {
          organizationId: ctx.organizationId,
          code: code,
          id: { not: id },
        },
      });

      if (duplicateCode) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CONFLICT",
              message: `A fee category with the code "${code}" already exists.`,
            },
          },
          { status: 409 }
        );
      }
    }

    // Check unique name if it's changing
    if (name && name !== existing.name) {
      const duplicateName = await prisma.feeCategory.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: name,
          id: { not: id },
        },
      });

      if (duplicateName) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CONFLICT",
              message: `A fee category with the name "${name}" already exists.`,
            },
          },
          { status: 409 }
        );
      }
    }

    const updatedCategory = await prisma.feeCategory.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        code: code !== undefined ? code : existing.code,
        description: description !== undefined ? description : existing.description,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    return NextResponse.json({ success: true, data: updatedCategory });
  } catch (error: any) {
    console.error("FeeCategory PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update fee category", details: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  try {
    const ctx = getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = resolvedParams;

    const existing = await prisma.feeCategory.findUnique({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Fee category not found" }, { status: 404 });
    }

    // Check for dependencies (FeeStructures)
    const dependenciesCount = await prisma.feeStructure.count({
      where: { feeCategoryId: id },
    });

    if (dependenciesCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "HAS_DEPENDENCIES",
            message: "This fee category is in use by fee structures. Please mark it as Inactive instead of deleting.",
          },
        },
        { status: 409 }
      );
    }

    await prisma.feeCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Fee category deleted successfully" });
  } catch (error: any) {
    console.error("FeeCategory DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete fee category", details: error.message } },
      { status: 500 }
    );
  }
}
