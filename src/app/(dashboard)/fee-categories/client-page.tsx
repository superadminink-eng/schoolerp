"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Edit, Archive, Play, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/ui/chip";
import { FeeCategoryDialog } from "@/components/fee-categories/fee-category-dialog";
import { useSnackbar } from "@/components/ui/snackbar";

export function FeeCategoryClientPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  
  const snackbar = useSnackbar();

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/fee-categories");
      const data = await res.json();
      if (res.ok) {
        setCategories(data.data);
      } else {
        throw new Error(data.error?.message || "Failed to fetch fee categories");
      }
    } catch (error: any) {
      snackbar.show(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = () => {
    setDialogMode("create");
    setSelectedCategory(null);
    setDialogOpen(true);
  };

  const handleEdit = (category: any) => {
    setDialogMode("edit");
    setSelectedCategory(category);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/v1/fee-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        snackbar.show(`Fee category ${!currentStatus ? "activated" : "archived"}`, "success");
        fetchCategories();
      } else {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to update status");
      }
    } catch (error: any) {
      snackbar.show(error.message, "error");
    }
  };

  const filteredCategories = categories.filter((category) => {
    const matchesSearch = 
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = showInactive ? true : category.isActive;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Categories</h1>
          <p className="text-sm text-muted-foreground">
            Manage the types of fees collected by your organization.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Fee Category
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 bg-card">
        <div className="relative w-full sm:w-72">
          <TextField
            label=""
            placeholder="Search categories or codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <label
            htmlFor="show-inactive"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Show Inactive (Archived)
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 font-medium">Category Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                    Loading categories...
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                    No fee categories found.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr 
                    key={category.id}
                    className={!category.isActive ? "bg-surface-variant/30 text-on-surface-variant" : "bg-surface hover:bg-surface-variant/50 transition-colors"}
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className={!category.isActive ? "line-through opacity-70" : ""}>
                        {category.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-surface-variant px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold">
                        {category.code}
                      </code>
                    </td>
                    <td className="px-4 py-3 opacity-80">
                      {category.description || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {category.isActive ? (
                        <Chip label="Active" color="success" />
                      ) : (
                        <Chip label="Archived" color="warning" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="text"
                          onClick={() => handleEdit(category)}
                          title="Edit Category"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => handleToggleStatus(category.id, category.isActive)}
                          title={category.isActive ? "Archive Category" : "Restore Category"}
                          className={!category.isActive ? "h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" : "h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"}
                        >
                          {category.isActive ? (
                            <Archive className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FeeCategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchCategories}
        mode={dialogMode}
        initialData={selectedCategory}
      />
    </div>
  );
}
