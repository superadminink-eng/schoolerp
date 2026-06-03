import { notFound } from "next/navigation";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { RoleForm } from "@/components/roles/role-form";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditRolePage(props: PageProps) {
  const { id } = await props.params;
  const session = await auth();

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: true,
    }
  });

  if (!role) {
    notFound();
  }

  const roleData = {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.rolePermissions.map((rp) => rp.permissionId),
  };

  const isUserAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const canEdit = !role.isSystem || isUserAdmin;

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/settings/roles">Roles</BreadcrumbItem>
        <BreadcrumbItem>{canEdit ? "Edit Role" : "View Role"}</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        {canEdit ? "Edit Role" : "View Role"}
      </h1>

      <RoleForm mode="edit" initialData={roleData} />
    </div>
  );
}
