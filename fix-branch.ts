import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    include: { organization: true }
  });

  for (const branch of branches) {
    if (branch.name === "Main Branch") {
      const baseSlug = branch.organization.slug.substring(0, 6).toUpperCase();
      await prisma.branch.update({
        where: { id: branch.id },
        data: {
          name: `${branch.organization.name} - Main Branch`,
          code: `${baseSlug}-MAIN`
        }
      });
      console.log(`Updated branch ${branch.id}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
