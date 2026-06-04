"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/ui/search-bar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useBranches } from "@/hooks/use-branches";
import { useRoles } from "@/hooks/use-roles";
import { FAB } from "@/components/ui/fab";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";



interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: { id: string; name: string };
  isActive: boolean;
  createdAt: string;
  branch: { id: string; name: string } | null;
}

const roleLabel = (name: string) =>
  name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());


export function UserListClient() {
  const router = useRouter();
  const { branches } = useBranches();
  const { roles } = useRoles();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "9999");
    if (roleFilter !== "ALL") params.set("roleId", roleFilter);
    if (branchFilter !== "ALL") params.set("branchId", branchFilter);

    try {
      const res = await fetch(`/api/v1/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch {
      // silently fail; loading state will clear
    } finally {
      setLoading(false);
    }
  }, [roleFilter, branchFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "Name",
      type: "avatar",
      avatarConfig: {
        firstName: (row) => row.name,
      },
    },
    {
      key: "email",
      header: "Email",
    },
    {
      key: "role",
      header: "Role",
      render: (row) => {
        const roleName = row.role?.name || "Unknown";
        const label = roleLabel(roleName);
        let iconName = "person";
        if (roleName.includes("ADMIN")) iconName = "security";
        else if (roleName.includes("TEACHER")) iconName = "school";
        else if (roleName.includes("LIBRARIAN")) iconName = "menu_book";
        
        return (
          <div className="flex items-center gap-2 text-slate-700 font-medium h-full">
            <Icon name={iconName} size={15} className="text-slate-400 shrink-0" />
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </div>
        );
      },
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) => row.branch?.name ?? "—",
    },
    {
      key: "status",
      header: "Status",
      type: "status-dot",
      statusDotConfig: {
        label: (row) => row.isActive ? "Active" : "Inactive",
        color: (row) => row.isActive ? "success" : "default",
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
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
              icon="edit"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/users/${row.id}/edit`);
              }}
            >
              Edit
            </MenuItem>
          </MenuContent>
        </Menu>
      ),
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
            placeholder="Search users"
            className="sm:max-w-xs"
          />
          <Select
            value={roleFilter}
            onValueChange={setRoleFilter}
          >
            <SelectTrigger className="min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              {roles.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {roleLabel(opt.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {branches.length > 1 && (
            <Select
              value={branchFilter}
              onValueChange={setBranchFilter}
            >
              <SelectTrigger className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <PermissionGate module="users" action="create">
          <Button
            variant="filled"
            icon="person_add"
            onClick={() => router.push("/users/new")}
            className="hidden md:inline-flex"
          >
            Add User
          </Button>
        </PermissionGate>
      </div>

      {/* Table */}
      <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/users/${row.id}/edit`)}
          loading={loading}
          emptyIcon="group_off"
          emptyMessage="No users found"
          quickFilter={searchInput}
        />
      </div>

      <PermissionGate module="users" action="create">
        <FAB icon="person_add" onClick={() => router.push("/users/new")} />
      </PermissionGate>
    </div>
  );
}
