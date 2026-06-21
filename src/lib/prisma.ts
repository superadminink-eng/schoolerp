import { PrismaClient } from "@prisma/client";

function buildDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  // Append connection pool settings if not already present
  if (url.includes("connection_limit")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=10&pool_timeout=20`;
}

const prismaClientSingleton = () => {
  const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasourceUrl: buildDatasourceUrl(),
  });

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
