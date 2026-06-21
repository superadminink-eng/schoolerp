import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  /**
   * WARNING: Prisma Client Extensions query filters (like setting deletedAt: null)
   * ONLY apply to top-level model actions (findMany, findFirst, count, etc.).
   * They do NOT automatically apply to:
   * 1. Relation loads via "include" or "select" (e.g., student.findFirst({ include: { invoices: true } }))
   * 2. Database aggregates (e.g. invoice.groupBy, invoice.aggregate)
   * 3. Nested filtering inside "where" (e.g., student.findMany({ where: { invoices: { some: { ... } } } }))
   *
   * You MUST explicitly pass `deletedAt: null` in these relation array and aggregate queries.
   */
  return basePrisma.$extends({
    query: {
      student: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          return (basePrisma as any).student.findFirst(findFirstArgs);
        },
        async findUniqueOrThrow({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          const result = await (basePrisma as any).student.findFirst(findFirstArgs);
          if (!result) {
            throw new Error("Student not found");
          }
          return result;
        },
        async count({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async delete({ args, query }) {
          return (basePrisma as any).student.update({
            where: args.where,
            data: { deletedAt: new Date(), status: "DROPPED" },
          });
        },
        async deleteMany({ args, query }) {
          return (basePrisma as any).student.updateMany({
            where: args.where,
            data: { deletedAt: new Date(), status: "DROPPED" },
          });
        },
      },
      staff: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          return (basePrisma as any).staff.findFirst(findFirstArgs);
        },
        async findUniqueOrThrow({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          const result = await (basePrisma as any).staff.findFirst(findFirstArgs);
          if (!result) {
            throw new Error("Staff member not found");
          }
          return result;
        },
        async count({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async delete({ args, query }) {
          return (basePrisma as any).staff.update({
            where: args.where,
            data: { deletedAt: new Date(), status: "TERMINATED" },
          });
        },
        async deleteMany({ args, query }) {
          return (basePrisma as any).staff.updateMany({
            where: args.where,
            data: { deletedAt: new Date(), status: "TERMINATED" },
          });
        },
      },
      invoice: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          return (basePrisma as any).invoice.findFirst(findFirstArgs);
        },
        async findUniqueOrThrow({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          const result = await (basePrisma as any).invoice.findFirst(findFirstArgs);
          if (!result) {
            throw new Error("Invoice not found");
          }
          return result;
        },
        async count({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async delete({ args, query }) {
          return (basePrisma as any).invoice.update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ args, query }) {
          return (basePrisma as any).invoice.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
      },
      feePayment: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          return (basePrisma as any).feePayment.findFirst(findFirstArgs);
        },
        async findUniqueOrThrow({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          const result = await (basePrisma as any).feePayment.findFirst(findFirstArgs);
          if (!result) {
            throw new Error("Fee payment not found");
          }
          return result;
        },
        async count({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async delete({ args, query }) {
          return (basePrisma as any).feePayment.update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ args, query }) {
          return (basePrisma as any).feePayment.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
      },
      class: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          return (basePrisma as any).class.findFirst(findFirstArgs);
        },
        async findUniqueOrThrow({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          const result = await (basePrisma as any).class.findFirst(findFirstArgs);
          if (!result) {
            throw new Error("Class not found");
          }
          return result;
        },
        async count({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async delete({ args, query }) {
          return (basePrisma as any).class.update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ args, query }) {
          return (basePrisma as any).class.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
      },
      section: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          return (basePrisma as any).section.findFirst(findFirstArgs);
        },
        async findUniqueOrThrow({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          const result = await (basePrisma as any).section.findFirst(findFirstArgs);
          if (!result) {
            throw new Error("Section not found");
          }
          return result;
        },
        async count({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async delete({ args, query }) {
          return (basePrisma as any).section.update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ args, query }) {
          return (basePrisma as any).section.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
      },
      academicYear: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          return (basePrisma as any).academicYear.findFirst(findFirstArgs);
        },
        async findUniqueOrThrow({ args, query }) {
          const findFirstArgs = {
            ...args,
            where: { ...args.where, deletedAt: null },
          } as any;
          const result = await (basePrisma as any).academicYear.findFirst(findFirstArgs);
          if (!result) {
            throw new Error("Academic year not found");
          }
          return result;
        },
        async count({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async delete({ args, query }) {
          return (basePrisma as any).academicYear.update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ args, query }) {
          return (basePrisma as any).academicYear.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
      },
    },
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = (globalForPrisma.prisma ?? prismaClientSingleton()) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
