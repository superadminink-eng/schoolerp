import { PrismaClient } from "@prisma/client";

// Accept both raw prisma client and transaction client (tx)
type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

async function getNextSequenceValue(
  prisma: PrismaTx,
  organizationId: string,
  type: string,
  year: number
): Promise<number> {
  if (!organizationId) {
    throw new Error(`organizationId is required for generating sequential sequence of type ${type}`);
  }
  const sequence = await prisma.systemSequence.upsert({
    where: {
      organizationId_type_year: {
        organizationId,
        type,
        year,
      },
    },
    update: {
      currentValue: {
        increment: 1,
      },
    },
    create: {
      organizationId,
      type,
      year,
      currentValue: 1,
    },
  });
  return sequence.currentValue;
}

/**
 * Generates a clean sequential student admission number atomically.
 */
export async function generateUniqueAdmissionNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const val = await getNextSequenceValue(prisma, organizationId, "ADMISSION", year);
  return `ADM-${year}-${String(val).padStart(5, "0")}`;
}

/**
 * Generates a clean sequential invoice number atomically.
 */
export async function generateUniqueInvoiceNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const val = await getNextSequenceValue(prisma, organizationId, "INVOICE", year);
  return `INV-${year}-${String(val).padStart(5, "0")}`;
}

/**
 * Generates a clean sequential payment receipt number atomically.
 */
export async function generateUniqueReceiptNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const val = await getNextSequenceValue(prisma, organizationId, "RECEIPT", year);
  return `RCP-${year}-${String(val).padStart(5, "0")}`;
}

/**
 * Generates a clean sequential admission application number atomically.
 */
export async function generateUniqueApplicationNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const val = await getNextSequenceValue(prisma, organizationId, "APPLICATION", year);
  return `APP-${year}-${String(val).padStart(5, "0")}`;
}
