import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    const appToken = await prisma.applicationToken.findUnique({
      where: { token },
      include: {
        application: {
          include: {
            class: true,
            documents: true,
          }
        }
      }
    });

    if (!appToken) {
      return NextResponse.json({ success: false, error: { message: "Invalid or expired link." } }, { status: 404 });
    }

    if (new Date() > appToken.expiresAt) {
      return NextResponse.json({ success: false, error: { message: "This link has expired." } }, { status: 403 });
    }

    if (appToken.isConsumed || appToken.application.status === "ADMITTED" || appToken.application.status === "REJECTED") {
      return NextResponse.json({ success: false, error: { message: "This application is already finalized. Link locked." } }, { status: 403 });
    }

    // Return masked data for privacy
    const app = appToken.application;
    const maskedName = `${app.firstName} ${app.lastName.charAt(0)}***`;
    const maskedParent = app.fatherName ? `${app.fatherName.charAt(0)}***` : "Parent";

    const payload = {
      id: app.id,
      applicationNo: app.applicationNo,
      studentName: maskedName,
      parentName: maskedParent,
      className: app.class?.name || "N/A",
      status: app.status,
      documents: app.documents.map(d => ({
        id: d.id,
        documentType: d.documentType,
        status: d.status,
        remarks: d.remarks,
      }))
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error: any) {
    console.error("Failed to fetch onboarding application:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error." } }, { status: 500 });
  }
}
