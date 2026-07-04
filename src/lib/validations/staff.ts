import { z } from "zod";
import { optionalPhoneSchema } from "./phone";


const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

const STAFF_STATUSES = ["ACTIVE", "ON_LEAVE", "RESIGNED", "TERMINATED"] as const;

export const createStaffSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  staffType: z.enum(["TEACHING", "NON_TEACHING"]).default("TEACHING"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: optionalPhoneSchema,
  roleId: z.string().min(1, "Role is required"),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(GENDERS).optional().or(z.literal("")),
  qualification: z
    .string()
    .max(200, "Qualification must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  joinDate: z.string().optional().or(z.literal("")),
  branchId: z.string().min(1, "Branch is required"),
  departmentId: z.string().optional().or(z.literal("")),
  designationIds: z.array(z.string()).optional(),
  createAccount: z.boolean().optional(),
  existingUserId: z.string().optional().or(z.literal("")),
  password: z.string().optional().or(z.literal("")),
  customPermissions: z.array(z.object({
    permissionId: z.string(),
    granted: z.boolean(),
  })).optional(),
}).refine((data) => {
  if (data.createAccount && (!data.password || data.password.length < 6)) {
    return false;
  }
  return true;
}, {
  message: "Password must be at least 6 characters when creating an account",
  path: ["password"],
}).refine((data) => {
  if (data.createAccount && !data.email) {
    return false;
  }
  return true;
}, {
  message: "Email is required when creating an account",
  path: ["email"],
});

export const updateStaffSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .optional(),
  staffType: z.enum(["TEACHING", "NON_TEACHING"]).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: optionalPhoneSchema,
  roleId: z.string().optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(GENDERS).optional().or(z.literal("")),
  qualification: z
    .string()
    .max(200, "Qualification must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  joinDate: z.string().optional().or(z.literal("")),
  branchId: z.string().min(1).optional(),
  departmentId: z.string().optional().or(z.literal("")),
  designationIds: z.array(z.string()).optional(),
  status: z.enum(STAFF_STATUSES).optional(),
  createAccount: z.boolean().optional(),
  password: z.string().optional().or(z.literal("")),
  customPermissions: z.array(z.object({
    permissionId: z.string(),
    granted: z.boolean(),
  })).optional(),
}).refine((data) => {
  if (data.createAccount && data.password && data.password.length > 0 && data.password.length < 6) {
    return false;
  }
  return true;
}, {
  message: "Password must be at least 6 characters",
  path: ["password"],
}).refine((data) => {
  if (data.createAccount && !data.email) {
    return false;
  }
  return true;
}, {
  message: "Email is required when creating an account",
  path: ["email"],
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
