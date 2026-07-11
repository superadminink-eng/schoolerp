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
  let val = await getNextSequenceValue(prisma, organizationId, "ADMISSION", year);
  let no = `ADM-${year}-${String(val).padStart(5, "0")}`;
  
  let exists = await prisma.student.findFirst({ where: { admissionNo: no } });
  while (exists) {
    val = await getNextSequenceValue(prisma, organizationId, "ADMISSION", year);
    no = `ADM-${year}-${String(val).padStart(5, "0")}`;
    exists = await prisma.student.findFirst({ where: { admissionNo: no } });
  }
  return no;
}

/**
 * Generates a clean sequential invoice number atomically.
 */
export async function generateUniqueInvoiceNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  let val = await getNextSequenceValue(prisma, organizationId, "INVOICE", year);
  let no = `INV-${year}-${String(val).padStart(5, "0")}`;

  let exists = await prisma.invoice.findUnique({ where: { number: no } });
  while (exists) {
    val = await getNextSequenceValue(prisma, organizationId, "INVOICE", year);
    no = `INV-${year}-${String(val).padStart(5, "0")}`;
    exists = await prisma.invoice.findUnique({ where: { number: no } });
  }
  return no;
}

/**
 * Generates a clean sequential payment receipt number atomically.
 */
export async function generateUniqueReceiptNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  let val = await getNextSequenceValue(prisma, organizationId, "RECEIPT", year);
  let no = `RCP-${year}-${String(val).padStart(5, "0")}`;

  let exists = await prisma.feePayment.findUnique({ where: { receiptNo: no } });
  while (exists) {
    val = await getNextSequenceValue(prisma, organizationId, "RECEIPT", year);
    no = `RCP-${year}-${String(val).padStart(5, "0")}`;
    exists = await prisma.feePayment.findUnique({ where: { receiptNo: no } });
  }
  return no;
}

/**
 * Generates a clean sequential admission application number atomically.
 */
export async function generateUniqueApplicationNo(prisma: PrismaTx, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  let val = await getNextSequenceValue(prisma, organizationId, "APPLICATION", year);
  let no = `APP-${year}-${String(val).padStart(5, "0")}`;

  let exists = await prisma.admissionApplication.findUnique({ where: { applicationNo: no } });
  while (exists) {
    val = await getNextSequenceValue(prisma, organizationId, "APPLICATION", year);
    no = `APP-${year}-${String(val).padStart(5, "0")}`;
    exists = await prisma.admissionApplication.findUnique({ where: { applicationNo: no } });
  }
  return no;
}
