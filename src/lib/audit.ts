import { prisma } from "./prisma";

interface AuditLogParams {
  organizationId: string;
  branchId?: string | null;
  userId?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | string;
  module: string;
  entityId: string;
  details?: any;
}

export async function logAction({
  organizationId,
  branchId,
  userId,
  action,
  module,
  entityId,
  details,
}: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        branchId,
        userId,
        action,
        module,
        entityId,
        details: details ? (typeof details === "string" ? details : JSON.stringify(details)) : null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
