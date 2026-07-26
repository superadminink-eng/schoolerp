import { z } from "zod";
import { requiredPhoneSchema, optionalPhoneSchema } from "./phone";


export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export const ID_TYPES = [
  "Aadhaar",
  "PAN Card",
  "Passport",
  "Voter ID",
  "Driving License",
  "Birth Certificate",
  "Other",
] as const;

export const PAYMENT_MODES = [
  "CASH",
  "ONLINE",
  "CHEQUE",
  "BANK_TRANSFER",
  "UPI",
] as const;

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export const STUDENT_CATEGORIES = [
  "GENERAL",
  "RTE",
  "SCHOLARSHIP",
  "STAFF_CHILD",
  "OTHER",
] as const;

const STUDENT_STATUSES = [
  "ACTIVE",
  "GRADUATED",
  "TRANSFERRED",
  "DROPPED",
  "SUSPENDED",
] as const;

export const createStudentSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be at most 100 characters"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name must be at most 100 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(GENDERS, { required_error: "Gender is required" }),
  bloodGroup: z.string().optional().or(z.literal("")),
  address: z.string().min(1, "Address is required").max(500),
  pincode: z.string().min(1, "Pincode is required").max(10),
  previousSchool: z.string().max(200).optional().or(z.literal("")),
  emergencyContact1: requiredPhoneSchema,
  emergencyContact2: optionalPhoneSchema,
  idType: z.string().min(1, "ID type is required"),
  idNumber: z.string().min(1, "ID number is required").max(50),
  guardianName: z.string().max(100).optional().or(z.literal("")),
  fatherName: z.string().max(100).optional().or(z.literal("")),
  fatherPhone: optionalPhoneSchema,
  fatherEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  fatherOccupation: z.string().max(100).optional().or(z.literal("")),
  motherName: z.string().max(100).optional().or(z.literal("")),
  motherPhone: optionalPhoneSchema,
  motherEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  motherOccupation: z.string().max(100).optional().or(z.literal("")),
  admissionDate: z.string().optional().or(z.literal("")),
  branchId: z.string().min(1, "Branch is required"),
  classId: z.string().optional().or(z.literal("")),
  sectionId: z.string().optional().or(z.literal("")),
  house: z.string().max(50).optional().or(z.literal("")),
  category: z.enum(STUDENT_CATEGORIES).default("GENERAL"),

  // Fee collection (optional — only when collecting fees at admission)
  discountPercent: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0, "Discount cannot be negative").max(100, "Discount cannot exceed 100%").optional()
  ),
  discountAmount: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0, "Discount amount cannot be negative").optional()
  ),
  optionalFeeIds: z.union([
    z.string().transform(v => [v]),
    z.array(z.string())
  ]).optional(),
  customInstallments: z.string().optional().transform((str) => {
    if (!str) return [];
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  }).pipe(
    z.array(
      z.object({
        name: z.string().min(1, "Installment name is required"),
        dueDate: z.string().min(1, "Due date is required"),
        amount: z.number().min(0, "Amount must be positive"),
      })
    )
  ),
  amountPaid: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().min(0, "Amount cannot be negative").optional()
  ),
  paymentMethod: z.enum(PAYMENT_MODES).optional().or(z.literal("")),
  transactionId: z.string().max(100).optional().or(z.literal("")),
}).refine((data) => {
  const dobStr = data.dateOfBirth;
  const admStr = data.admissionDate || new Date().toISOString().slice(0, 10);
  if (!dobStr || !admStr) return true;
  const dob = new Date(dobStr);
  const adm = new Date(admStr);
  if (isNaN(dob.getTime()) || isNaN(adm.getTime())) return true;
  const ageAtAdmission = (adm.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return ageAtAdmission >= 3.0;
}, {
  message: "Student must be at least 3 years old on the admission date",
  path: ["dateOfBirth"]
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.string().optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  pincode: z.string().max(10).optional().or(z.literal("")),
  previousSchool: z.string().max(200).optional().or(z.literal("")),
  emergencyContact1: optionalPhoneSchema,
  emergencyContact2: optionalPhoneSchema,
  idType: z.string().optional().or(z.literal("")),
  idNumber: z.string().max(50).optional().or(z.literal("")),
  guardianName: z.string().max(100).optional().or(z.literal("")),
  fatherName: z.string().max(100).optional().or(z.literal("")),
  fatherPhone: optionalPhoneSchema,
  fatherEmail: z.string().email().optional().or(z.literal("")),
  fatherOccupation: z.string().max(100).optional().or(z.literal("")),
  motherName: z.string().max(100).optional().or(z.literal("")),
  motherPhone: optionalPhoneSchema,
  motherEmail: z.string().email().optional().or(z.literal("")),
  motherOccupation: z.string().max(100).optional().or(z.literal("")),
  admissionDate: z.string().optional().or(z.literal("")),
  branchId: z.string().min(1).optional().or(z.literal("")),
  sectionId: z.string().min(1).optional().or(z.literal("")),
  status: z.enum(STUDENT_STATUSES).optional(),
  house: z.string().max(50).optional().or(z.literal("")),
  category: z.enum(STUDENT_CATEGORIES).optional(),
  leavingDate: z.string().optional().or(z.literal("")),
  leavingReason: z.string().max(500).optional().or(z.literal("")),
}).refine((data) => {
  if (data.dateOfBirth && data.admissionDate) {
    const dob = new Date(data.dateOfBirth);
    const adm = new Date(data.admissionDate);
    if (isNaN(dob.getTime()) || isNaN(adm.getTime())) return true;
    const ageAtAdmission = (adm.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return ageAtAdmission >= 3.0;
  }
  return true;
}, {
  message: "Student must be at least 3 years old on the admission date",
  path: ["dateOfBirth"]
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
