"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SearchBar } from "@/components/ui/search-bar";
import { DataTable } from "@/components/ui/lazy-table";
import type { Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { FAB } from "@/components/ui/fab";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Icon } from "@/components/ui/icon";
import { useRoles, type Role } from "@/hooks/use-roles";

export function RoleListClient() {
  const router = useRouter();
  const { roles, loading } = useRoles();
  const { data: session } = useSession();
  const [searchInput, setSearchInput] = useState("");

  const isUserAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";

  const roleLabel = (name: string) =>
    name
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const columns: Column<Role>[] = [
    {
      key: "name",
      header: "Role Name",
      render: (row) => roleLabel(row.name),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => row.description || "—",
    },
    {
      key: "type",
      header: "Type",
      type: "badge",
      badgeConfig: {
        label: (row) => row.isSystem ? "System" : "Custom",
        color: (row) => row.isSystem ? "primary" : "default",
        icon: (row) => row.isSystem ? "cpu" : "sparkles",
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const canEdit = !row.isSystem || isUserAdmin;
        return (
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                className="rounded-full p-1 hover:bg-on-surface/8 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="more_vert" size={20} className="text-on-surface-variant" />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                icon={canEdit ? "edit" : "visibility"}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/roles/${row.id}/edit`);
                }}
              >
                {canEdit ? "Edit" : "View"}
              </MenuItem>
            </MenuContent>
          </Menu>
        );
      },
      className: "w-12",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search roles"
            className="sm:max-w-xs"
          />
        </div>
        <PermissionGate module="settings" action="manage">
          <Button
            variant="filled"
            icon="add"
            onClick={() => router.push("/roles/new")}
            className="hidden md:inline-flex"
          >
            Create Role
          </Button>
        </PermissionGate>
      </div>

      {/* Table */}
      <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
        <DataTable
          columns={columns}
          data={roles}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/roles/${row.id}/edit`)}
          loading={loading}
          emptyIcon="security"
          emptyMessage="No roles found"
          quickFilter={searchInput}
        />
      </div>

      <PermissionGate module="settings" action="manage">
        <FAB icon="add" onClick={() => router.push("/roles/new")} />
      </PermissionGate>
    </div>
  );
}
