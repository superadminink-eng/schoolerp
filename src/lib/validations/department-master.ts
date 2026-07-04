import { z } from "zod";

export const createDepartmentMasterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Department name is required")
    .max(100, "Name must be at most 100 characters"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Code is required")
    .max(30, "Code must be at most 30 characters")
    .regex(
      /^[A-Z0-9_-]+$/,
      "Code must be uppercase alphanumeric (A-Z, 0-9, _, -)"
    ),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
});

export const updateDepartmentMasterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Department name is required")
    .max(100, "Name must be at most 100 characters")
    .optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Code is required")
    .max(30, "Code must be at most 30 characters")
    .regex(
      /^[A-Z0-9_-]+$/,
      "Code must be uppercase alphanumeric (A-Z, 0-9, _, -)"
    )
    .optional(),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

export type CreateDepartmentMasterInput = z.infer<typeof createDepartmentMasterSchema>;
export type UpdateDepartmentMasterInput = z.infer<typeof updateDepartmentMasterSchema>;
