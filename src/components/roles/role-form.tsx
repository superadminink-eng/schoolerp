"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Card, CardContent } from "@/components/ui/card";
import { useSnackbar } from "@/components/ui/snackbar";
import { Checkbox } from "@/components/ui/checkbox"; // Assuming this exists, I'll check it, otherwise fallback

interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

interface RoleData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[]; // array of permission IDs
}

interface RoleFormProps {
  mode: "create" | "edit";
  initialData?: RoleData;
}

export function RoleForm({ mode, initialData }: RoleFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(initialData?.permissions ?? [])
  );
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSystem = initialData?.isSystem ?? false;

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const res = await fetch("/api/v1/permissions");
        const data = await res.json();
        if (data.success) {
          setPermissions(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    fetchPermissions();
  }, []);

  // Group permissions by module
  const modules = Array.from(new Set(permissions.map((p) => p.module)));

  const togglePermission = (id: string) => {
    if (isSystem) return; // cannot edit system roles
    const next = new Set(selectedPerms);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPerms(next);
  };

  const toggleModule = (moduleName: string) => {
    if (isSystem) return;
    const modulePerms = permissions.filter((p) => p.module === moduleName);
    const allSelected = modulePerms.every((p) => selectedPerms.has(p.id));
    
    const next = new Set(selectedPerms);
    if (allSelected) {
      modulePerms.forEach((p) => next.delete(p.id));
    } else {
      modulePerms.forEach((p) => next.add(p.id));
    }
    setSelectedPerms(next);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSystem) return;

    setErrors({});
    if (name.trim().length < 2) {
      setErrors({ name: "Name must be at least 2 characters" });
      return;
    }
    if (selectedPerms.size === 0) {
      snackbar.show("Please select at least one permission");
      return;
    }

    setLoading(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      permissions: Array.from(selectedPerms),
    };

    try {
      const url = mode === "create" ? "/api/v1/roles" : `/api/v1/roles/${initialData!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        snackbar.show(data.error?.message ?? "Failed to save role");
        return;
      }

      snackbar.show(mode === "create" ? "Role created" : "Role updated");
      router.push("/settings/roles");
      router.refresh();
    } catch (err) {
      snackbar.show("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <Card variant="outlined">
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Role Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
              fullWidth
              disabled={isSystem}
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              disabled={isSystem}
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent className="p-6">
          <h2 className="text-title-lg font-medium text-on-surface mb-4">Permissions</h2>
          
          {fetching ? (
            <div className="text-body-md text-on-surface-variant">Loading permissions...</div>
          ) : (
            <div className="space-y-6">
              {modules.map((mod) => {
                const modulePerms = permissions.filter((p) => p.module === mod);
                const allSelected = modulePerms.every((p) => selectedPerms.has(p.id));
                const someSelected = modulePerms.some((p) => selectedPerms.has(p.id));
                
                return (
                  <div key={mod} className="border border-outline-variant rounded-md overflow-hidden">
                    <div 
                      className="bg-surface-container-low px-4 py-3 flex items-center gap-3 cursor-pointer"
                      onClick={() => toggleModule(mod)}
                    >
                      <input 
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected;
                        }}
                        readOnly
                        disabled={isSystem}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="capitalize font-medium text-on-surface">
                        {mod.replace(/_/g, " ")} Module
                      </span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {modulePerms.map((perm) => (
                        <label 
                          key={perm.id} 
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPerms.has(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            disabled={isSystem}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-body-md text-on-surface group-hover:text-primary transition-colors">
                            {perm.action}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/settings/roles")}
        >
          {isSystem ? "Back" : "Cancel"}
        </Button>
        {!isSystem && (
          <Button type="submit" variant="filled" loading={loading} icon="save">
            {mode === "create" ? "Create Role" : "Save Changes"}
          </Button>
        )}
      </div>
    </form>
  );
}
