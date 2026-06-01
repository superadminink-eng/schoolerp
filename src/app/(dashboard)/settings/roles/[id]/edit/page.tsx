import { notFound } from "next/navigation";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { RoleForm } from "@/components/roles/role-form";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditRolePage(props: PageProps) {
  const { id } = await props.params;

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

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/settings/roles">Roles</BreadcrumbItem>
        <BreadcrumbItem>{role.isSystem ? "View Role" : "Edit Role"}</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        {role.isSystem ? "View Role" : "Edit Role"}
      </h1>

      <RoleForm mode="edit" initialData={roleData} />
    </div>
  );
}
