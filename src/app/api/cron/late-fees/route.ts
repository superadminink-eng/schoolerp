import { NextRequest, NextResponse } from "next/server";
import { runLateFeesCalculation } from "@/lib/tasks/late-fees-cron";

export async function GET(req: NextRequest) {
  // Verify token to prevent unauthorized triggers in production
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === "production" && cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  try {
    const result = await runLateFeesCalculation();
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Late fee calculations completed successfully",
        updatedCount: result.updatedCount,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process late fees" },
      { status: 500 }
    );
  }
}
