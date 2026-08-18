import { PrismaClient } from "@prisma/client";

// Accept both raw prisma client and transaction client (tx)
type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

async function getNextSequenceValues(
  prisma: PrismaTx,
  organizationId: string,
  type: string,
  year: number,
  count: number = 1
): Promise<number[]> {
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
        increment: count,
      },
    },
    create: {
      organizationId,
      type,
      year,
      currentValue: count,
    },
  });
  
  // Calculate the starting value of the reserved block
  const start = sequence.currentValue - count + 1;
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push(start + i);
  }
  return values;
}

async function getNextSequenceValue(
  prisma: PrismaTx,
  organizationId: string,
  type: string,
  year: number
): Promise<number> {
  const vals = await getNextSequenceValues(prisma, organizationId, type, year, 1);
  return vals[0];
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
 * Generates multiple clean sequential invoice numbers atomically in bulk.
 */
export async function generateUniqueInvoiceNos(prisma: PrismaTx, organizationId: string, count: number): Promise<string[]> {
  if (count <= 0) return [];
  const year = new Date().getFullYear();
  const vals = await getNextSequenceValues(prisma, organizationId, "INVOICE", year, count);
  return vals.map(val => `INV-${year}-${String(val).padStart(5, "0")}`);
}

/**
 * Generates a clean sequential invoice number atomically.
 */
export async function generateUniqueInvoiceNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const res = await generateUniqueInvoiceNos(prisma, organizationId, 1);
  return res[0];
}

/**
 * Generates multiple clean sequential payment receipt numbers atomically in bulk.
 */
export async function generateUniqueReceiptNos(prisma: PrismaTx, organizationId: string, count: number): Promise<string[]> {
  if (count <= 0) return [];
  const year = new Date().getFullYear();
  const vals = await getNextSequenceValues(prisma, organizationId, "RECEIPT", year, count);
  return vals.map(val => `RCP-${year}-${String(val).padStart(5, "0")}`);
}

/**
 * Generates a clean sequential payment receipt number atomically.
 */
export async function generateUniqueReceiptNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const res = await generateUniqueReceiptNos(prisma, organizationId, 1);
  return res[0];
}

/**
 * Generates a clean sequential admission application number atomically.
 */
export async function generateUniqueApplicationNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const val = await getNextSequenceValue(prisma, organizationId, "APPLICATION", year);
  return `APP-${year}-${String(val).padStart(5, "0")}`;
}
