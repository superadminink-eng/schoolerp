import { z } from "zod";

const sectionSubjectTeacherSchema = z.object({
  subjectIndex: z.number().int().min(0),
  staffId: z.string().min(1, "Teacher is required"),
});

const sectionSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1, "Division name is required")
    .max(20, "Division name must be at most 20 characters"),
  classTeacherId: z.string().nullable().optional(),
  subjectTeachers: z.array(sectionSubjectTeacherSchema).default([]),
});

const inlineFeeSchema = z.object({
  id: z.string().optional(),
  feeCategoryId: z.string().min(1, "Fee category is required"),
  amount: z.number().positive("Amount must be positive"),
  termType: z.enum(["FULL_TERM", "HALF_TERM", "SHORT_TERM"]).default("FULL_TERM"),
});

const inlineInstallmentSchema = z.object({
  id: z.string().optional(),
  installmentMasterId: z.string().nullish(),
  name: z
    .string()
    .min(1, "Installment name is required")
    .max(100, "Installment name must be at most 100 characters"),
  amount: z.number().positive("Amount must be positive"),
  dueDate: z.string().min(1, "Due date is required"),
  termType: z.enum(["FULL_TERM", "HALF_TERM", "SHORT_TERM"]).default("FULL_TERM"),
  lateFeeActive: z.boolean().default(false),
  lateFeeType: z.enum(["DAILY", "LUMP_SUM", "PERCENTAGE"]).default("DAILY"),
  lateFeeValue: z.number().nonnegative("Late fee value must be at least 0").default(0),
  lateFeePerDay: z.number().nonnegative("Late fee per day must be at least 0").default(0),
  lateFeeGrace: z.number().int().nonnegative("Grace days must be at least 0").default(0),
});

export const createClassSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  numericGrade: z
    .number()
    .int("Grade must be a whole number")
    .min(-10, "Grade must be at least -10")
    .max(20, "Grade must be at most 20"),
  branchId: z.string().min(1, "Branch is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  subjectMasterIds: z.array(z.string()).default([]),
  sections: z
    .array(sectionSchema)
    .min(1, "At least one division is required"),
  fees: z.array(inlineFeeSchema).default([]),
  installments: z.array(inlineInstallmentSchema).default([]),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
}).superRefine((data, ctx) => {
  // Installments validation
  if (data.installments && data.installments.length > 0) {
    const instGroups: Record<string, typeof data.installments> = {};
    for (const inst of data.installments) {
      if (!instGroups[inst.termType]) instGroups[inst.termType] = [];
      instGroups[inst.termType].push(inst);
    }
    for (const termType in instGroups) {
      const list = instGroups[termType];
      for (let i = 1; i < list.length; i++) {
        const prevDate = new Date(list[i - 1].dueDate);
        const currDate = new Date(list[i].dueDate);
        if (!isNaN(prevDate.getTime()) && !isNaN(currDate.getTime())) {
          if (currDate < prevDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Installment due dates must be in chronological order (e.g. Installment 2 cannot be before Installment 1)",
              path: ["installments"],
            });
            break;
          }
        }
      }
    }
  }

  // Fees uniqueness validation
  if (data.fees && data.fees.length > 0) {
    const feeGroups: Record<string, any[]> = {};
    data.fees.forEach((fee, index) => {
      if (!feeGroups[fee.termType]) feeGroups[fee.termType] = [];
      feeGroups[fee.termType].push({ ...fee, index });
    });

    for (const termType in feeGroups) {
      const list = feeGroups[termType];
      const seen = new Set<string>();
      for (const item of list) {
        if (seen.has(item.feeCategoryId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate fee component detected for this term.",
            path: ["fees", item.index, "feeCategoryId"],
          });
        }
        seen.add(item.feeCategoryId);
      }
    }
  }
});

// For update, subjects are expressed as an array of { id } (keep) or { subjectMasterId } (add new)
const updateSubjectEntry = z.union([
  z.object({ id: z.string() }),
  z.object({ subjectMasterId: z.string() }),
]);

export const updateClassSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters")
    .optional(),
  numericGrade: z
    .number()
    .int("Grade must be a whole number")
    .min(-10, "Grade must be at least -10")
    .max(20, "Grade must be at most 20")
    .optional(),
  branchId: z.string().optional(),
  academicYearId: z.string().optional(),
  subjects: z.array(updateSubjectEntry).optional(),
  sections: z.array(sectionSchema).optional(),
  fees: z.array(inlineFeeSchema).optional(),
  installments: z.array(inlineInstallmentSchema).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
}).superRefine((data, ctx) => {
  // Installments validation
  if (data.installments && data.installments.length > 0) {
    const instGroups: Record<string, typeof data.installments> = {};
    for (const inst of data.installments) {
      if (!instGroups[inst.termType]) instGroups[inst.termType] = [];
      instGroups[inst.termType].push(inst);
    }
    for (const termType in instGroups) {
      const list = instGroups[termType];
      for (let i = 1; i < list.length; i++) {
        const prevDate = new Date(list[i - 1].dueDate);
        const currDate = new Date(list[i].dueDate);
        if (!isNaN(prevDate.getTime()) && !isNaN(currDate.getTime())) {
          if (currDate < prevDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Installment due dates must be in chronological order (e.g. Installment 2 cannot be before Installment 1)",
              path: ["installments"],
            });
            break;
          }
        }
      }
    }
  }

  // Fees uniqueness validation
  if (data.fees && data.fees.length > 0) {
    const feeGroups: Record<string, any[]> = {};
    data.fees.forEach((fee, index) => {
      if (!feeGroups[fee.termType]) feeGroups[fee.termType] = [];
      feeGroups[fee.termType].push({ ...fee, index });
    });

    for (const termType in feeGroups) {
      const list = feeGroups[termType];
      const seen = new Set<string>();
      for (const item of list) {
        if (seen.has(item.feeCategoryId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate fee component detected for this term.",
            path: ["fees", item.index, "feeCategoryId"],
          });
        }
        seen.add(item.feeCategoryId);
      }
    }
  }
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
