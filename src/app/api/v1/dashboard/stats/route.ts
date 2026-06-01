import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized } from "@/lib/api-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiUnauthorized();

  const orgId = session.user.organizationId;
  const branchId = session.user.branchId;
  const isBranchScoped = session.user.roleName === "BRANCH_ADMIN";

  const branchWhere = {
    branch: {
      organizationId: orgId,
      ...(isBranchScoped && branchId ? { id: branchId } : {}),
    },
  };

  const [students, staff, branches, users] = await Promise.all([
    prisma.student.count({
      where: { ...branchWhere, status: "ACTIVE" },
    }),
    prisma.staff.count({
      where: { ...branchWhere, status: "ACTIVE" },
    }),
    prisma.branch.count({
      where: { organizationId: orgId, isActive: true },
    }),
    prisma.user.count({
      where: { organizationId: orgId, isActive: true },
    }),
  ]);

  return apiSuccess({ students, staff, branches, users });
}
