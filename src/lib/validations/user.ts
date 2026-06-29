import { z } from "zod";
import { optionalPhoneSchema } from "./phone";




export const createUserSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  email: z.string().email("Invalid email address"),
  phone: optionalPhoneSchema,
  roleId: z.string().min(1, "Role is required"),
  branchId: z.string().min(1, "Branch is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  customPermissions: z.array(
    z.object({
      permissionId: z.string(),
      granted: z.boolean(),
    })
  ).optional(),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .optional(),
  phone: optionalPhoneSchema,
  roleId: z.string().optional(),
  branchId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .optional()
    .or(z.literal("")),
  customPermissions: z.array(
    z.object({
      permissionId: z.string(),
      granted: z.boolean(),
    })
  ).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
