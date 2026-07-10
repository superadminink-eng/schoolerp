import { z } from "zod";

export const createInstallmentMasterSchema = z.object({
  name: z
    .string()
    .min(1, "Installment name is required")
    .max(100, "Installment name must be at most 100 characters"),
  code: z
    .string()
    .min(1, "Installment code is required")
    .max(50, "Installment code must be at most 50 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Code must contain only letters, numbers, and underscores"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
});

export const updateInstallmentMasterSchema = createInstallmentMasterSchema.partial().extend({
  isActive: z.boolean().optional(),
});
