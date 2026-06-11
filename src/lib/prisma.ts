import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
};

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

const extendedClient = basePrisma.$extends({
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
        return basePrisma.student.findFirst(findFirstArgs);
      },
      async findUniqueOrThrow({ args, query }) {
        const findFirstArgs = {
          ...args,
          where: { ...args.where, deletedAt: null },
        } as any;
        const result = await basePrisma.student.findFirst(findFirstArgs);
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
        return basePrisma.student.update({
          where: args.where,
          data: { deletedAt: new Date(), status: "DROPPED" },
        });
      },
      async deleteMany({ args, query }) {
        return basePrisma.student.updateMany({
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
        return basePrisma.staff.findFirst(findFirstArgs);
      },
      async findUniqueOrThrow({ args, query }) {
        const findFirstArgs = {
          ...args,
          where: { ...args.where, deletedAt: null },
        } as any;
        const result = await basePrisma.staff.findFirst(findFirstArgs);
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
        return basePrisma.staff.update({
          where: args.where,
          data: { deletedAt: new Date(), status: "TERMINATED" },
        });
      },
      async deleteMany({ args, query }) {
        return basePrisma.staff.updateMany({
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
        return basePrisma.invoice.findFirst(findFirstArgs);
      },
      async findUniqueOrThrow({ args, query }) {
        const findFirstArgs = {
          ...args,
          where: { ...args.where, deletedAt: null },
        } as any;
        const result = await basePrisma.invoice.findFirst(findFirstArgs);
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
        return basePrisma.invoice.update({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
      async deleteMany({ args, query }) {
        return basePrisma.invoice.updateMany({
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
        return basePrisma.feePayment.findFirst(findFirstArgs);
      },
      async findUniqueOrThrow({ args, query }) {
        const findFirstArgs = {
          ...args,
          where: { ...args.where, deletedAt: null },
        } as any;
        const result = await basePrisma.feePayment.findFirst(findFirstArgs);
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
        return basePrisma.feePayment.update({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
      async deleteMany({ args, query }) {
        return basePrisma.feePayment.updateMany({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
    },
  },
});

export const prisma = (globalForPrisma.prisma ?? extendedClient) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
