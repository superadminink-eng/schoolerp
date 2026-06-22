import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFeeCategorySchema } from "@/lib/validations/fee-category";
import { getTenantContext } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const ctx = getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const categories = await prisma.feeCategory.findMany({
      where: {
        organizationId: ctx.organizationId,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    console.error("FeeCategory GET Error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch fee categories", details: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = createFeeCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Validation failed", details: parsed.error.format() } },
        { status: 400 }
      );
    }

    const { name, code, description, isActive } = parsed.data;

    // Check Unique Code
    const duplicateCode = await prisma.feeCategory.findFirst({
      where: {
        organizationId: ctx.organizationId,
        code: code,
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

    // Check Unique Name
    const duplicateName = await prisma.feeCategory.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: name,
      },
    });

    if (duplicateName) {
      if (!duplicateName.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ARCHIVED_CONFLICT",
              message: `A fee category with the name "${name}" is currently archived. Would you like to restore it?`,
              meta: { duplicateId: duplicateName.id },
            },
          },
          { status: 409 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CONFLICT",
              message: `An active fee category with the name "${name}" already exists.`,
            },
          },
          { status: 409 }
        );
      }
    }

    const newCategory = await prisma.feeCategory.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        code,
        description,
        isActive,
      },
    });

    return NextResponse.json({ success: true, data: newCategory }, { status: 201 });
  } catch (error: any) {
    console.error("FeeCategory POST Error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create fee category", details: error.message } },
      { status: 500 }
    );
  }
}
