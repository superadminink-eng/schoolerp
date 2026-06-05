import { z } from "zod";

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export const INQUIRY_SOURCES = [
  "WEBSITE",
  "WALK_IN",
  "SOCIAL_MEDIA",
  "REFERRAL",
  "NEWSPAPER",
  "OTHER",
] as const;

export const INQUIRY_STATUSES = [
  "INQUIRY",
  "CONTACTED",
  "VISITED",
  "APPLIED",
  "CLOSED",
] as const;

export const APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "DOCUMENT_VERIFICATION",
  "TEST_SCHEDULED",
  "SHORTLISTED",
  "REJECTED",
  "ADMITTED",
  "WITHDRAWN",
] as const;

export const createInquirySchema = z.object({
  studentName: z
    .string()
    .min(1, "Student name is required")
    .max(100, "Student name must be at most 100 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(GENDERS, { required_error: "Gender is required" }),
  classAppliedId: z.string().min(1, "Applied class is required"),
  parentName: z
    .string()
    .min(1, "Parent name is required")
    .max(100, "Parent name must be at most 100 characters"),
  parentPhone: z
    .string()
    .min(1, "Parent phone number is required")
    .max(20, "Phone number must be at most 20 characters"),
  parentEmail: z
    .string()
    .email("Invalid email address")
    .min(1, "Parent email is required"),
  source: z.enum(INQUIRY_SOURCES).optional().default("WEBSITE"),
  status: z.enum(INQUIRY_STATUSES).optional().default("INQUIRY"),
  notes: z.string().max(1000).optional().or(z.literal("")),
  branchId: z.string().min(1, "Branch is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
});

export const createFollowUpSchema = z.object({
  conversationNotes: z
    .string()
    .min(1, "Conversation notes are required")
    .max(2000, "Notes cannot exceed 2000 characters"),
  nextFollowUpDate: z.string().optional().or(z.literal("")),
  statusReached: z.enum(INQUIRY_STATUSES, {
    required_error: "Status reached is required",
  }),
});

export const createApplicationSchema = z.object({
  inquiryId: z.string().optional().or(z.literal("")),
  branchId: z.string().min(1, "Branch is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: z.string().min(1, "Class is required"),
  
  // Applicant details
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
  emergencyContact: z
    .string()
    .min(1, "Emergency contact is required")
    .max(20),

  // Parents details
  fatherName: z.string().max(100).optional().or(z.literal("")),
  fatherPhone: z.string().max(20).optional().or(z.literal("")),
  fatherEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  fatherOccupation: z.string().max(100).optional().or(z.literal("")),
  motherName: z.string().max(100).optional().or(z.literal("")),
  motherPhone: z.string().max(20).optional().or(z.literal("")),
  motherEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  motherOccupation: z.string().max(100).optional().or(z.literal("")),
});
