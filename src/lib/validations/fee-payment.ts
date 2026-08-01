import { z } from "zod";

export const PAYMENT_METHODS = [
  "CASH",
  "ONLINE",
  "CHEQUE",
  "BANK_TRANSFER",
  "UPI",
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  ONLINE: "Online",
  CHEQUE: "Cheque",
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
};

export const createFeePaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero").refine((n) => {
    const str = n.toString();
    if (!str.includes('.')) return true;
    return str.split('.')[1].length <= 2;
  }, "Amount can only have up to 2 decimal places"),
  method: z.enum(PAYMENT_METHODS, { required_error: "Payment method is required" }),
  paidAt: z.string().min(1, "Payment date is required"),
  transactionId: z.string().max(100).optional().or(z.literal("")),
  remarks: z.string().max(500).optional().or(z.literal("")),
  invoiceId: z.string().optional(),
});

export type CreateFeePaymentInput = z.infer<typeof createFeePaymentSchema>;
