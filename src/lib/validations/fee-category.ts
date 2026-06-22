import { z } from "zod";

export const createFeeCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Code is required")
    .max(20, "Code must be at most 20 characters")
    .regex(
      /^[A-Z0-9_]+$/,
      "Code must be uppercase alphanumeric (A-Z, 0-9, _)"
    ),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
  isActive: z.boolean().default(true),
});

export const updateFeeCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters")
    .optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Code is required")
    .max(20, "Code must be at most 20 characters")
    .regex(
      /^[A-Z0-9_]+$/,
      "Code must be uppercase alphanumeric (A-Z, 0-9, _)"
    )
    .optional(),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});
