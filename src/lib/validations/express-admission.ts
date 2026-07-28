import { z } from "zod";
import { requiredPhoneSchema } from "./phone";


const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export const PAYMENT_MODES = [
  "CASH",
  "ONLINE",
  "CHEQUE",
  "BANK_TRANSFER",
  "UPI",
] as const;

export const TERM_TYPES = [
  "FULL_TERM",
  "HALF_TERM",
  "SHORT_TERM",
] as const;

export const INQUIRY_SOURCES = [
  "WEBSITE",
  "WALK_IN",
  "SOCIAL_MEDIA",
  "REFERRAL",
  "NEWSPAPER",
  "OTHER",
] as const;

// Option 1: Promote existing inquiry to student
export const expressAdmitSchema = z.object({
  sectionId: z.string().min(1, "Section is required"),
  rollNo: z.string().max(20).optional().or(z.literal("")),
  admissionDate: z.string().optional().or(z.literal("")),
  discountAmount: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0, "Discount cannot be negative").max(100, "Discount cannot exceed 100%").optional()
  ),
  amountPaid: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0, "Amount paid cannot be negative").optional()
  ),
  paymentMethod: z.enum(PAYMENT_MODES).optional().or(z.literal("")),
  transactionId: z.string().max(100).optional().or(z.literal("")),
  termType: z.enum(TERM_TYPES).optional().default("FULL_TERM"),
  installments: z.array(
    z.object({
      templateId: z.string(),
      amount: z.number().min(0),
    })
  ).optional(),
});

// Option 2: Create inquiry and admit student in a single submission
export const expressCreateSchema = z.object({
  // Student core biodata (from inquiry)
  studentName: z
    .string()
    .min(1, "Student name is required")
    .max(100, "Student name must be at most 100 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(GENDERS, { required_error: "Gender is required" }),
  classAppliedId: z.string().min(1, "Applied class is required"),
  
  // Parent details (from inquiry)
  parentName: z
    .string()
    .min(1, "Parent name is required")
    .max(100, "Parent name must be at most 100 characters"),
  parentPhone: requiredPhoneSchema,
  parentEmail: z
    .string()
    .email("Invalid email address")
    .min(1, "Parent email is required"),
  source: z.enum(INQUIRY_SOURCES).optional().default("WALK_IN"),
  notes: z.string().max(1000).optional().or(z.literal("")),
  
  // Scopes
  branchId: z.string().min(1, "Branch is required"),
  academicYearId: z.string().min(1, "Academic year is required"),

  // Express Admission Fields (Option 1 details)
  sectionId: z.string().min(1, "Section is required"),
  rollNo: z.string().max(20).optional().or(z.literal("")),
  admissionDate: z.string().optional().or(z.literal("")),
  discountAmount: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(100).optional()
  ),
  amountPaid: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  paymentMethod: z.enum(PAYMENT_MODES).optional().or(z.literal("")),
  transactionId: z.string().max(100).optional().or(z.literal("")),
  termType: z.enum(TERM_TYPES).optional().default("FULL_TERM"),
});

export type ExpressAdmitInput = z.infer<typeof expressAdmitSchema>;
export type ExpressCreateInput = z.infer<typeof expressCreateSchema>;
