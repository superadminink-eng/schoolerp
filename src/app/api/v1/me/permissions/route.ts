import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/rbac";
import { apiSuccess, apiError } from "@/lib/api-helpers";


export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return apiError("UNAUTHORIZED", "Not authenticated", 401);
  }

  const permissions = await getUserPermissions(
    session.user.id,
    session.user.roleId,
    session.user.roleName
  );

  return apiSuccess({
    roleId: session.user.roleId,
    roleName: session.user.roleName,
    permissions: Array.from(permissions),
  });
}
