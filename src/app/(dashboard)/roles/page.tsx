import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { RoleListClient } from "@/components/roles/role-list-client";

export default function RolesPage() {
  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem>Roles</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Roles & Permissions
      </h1>
      <RoleListClient />
    </div>
  );
}
