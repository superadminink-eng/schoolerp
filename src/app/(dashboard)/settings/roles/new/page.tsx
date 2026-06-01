import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { RoleForm } from "@/components/roles/role-form";

export default function NewRolePage() {
  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/settings/roles">Roles</BreadcrumbItem>
        <BreadcrumbItem>New Role</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Create New Role
      </h1>
      
      <RoleForm mode="create" />
    </div>
  );
}
