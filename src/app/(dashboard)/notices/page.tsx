"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { SearchBar } from "@/components/ui/search-bar";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { useSnackbar } from "@/components/ui/snackbar";
import { cn } from "@/lib/utils";
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "@/components/ui/menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { TextField } from "@/components/ui/text-field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useBranches } from "@/hooks/use-branches";
import { createNoticeSchema, updateNoticeSchema } from "@/lib/validations/notice";

interface NoticeRow {
  id: string;
  title: string;
  content: string;
  targetRoles: string[];
  branchId: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  branch?: {
    id: string;
    name: string;
  } | null;
}

interface LocalMetricCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  color: "teal" | "emerald" | "amber" | "sky";
}

function LocalMetricCard({ title, value, subtitle, icon, color }: LocalMetricCardProps) {
  const colors = {
    teal: {
      bg: "bg-teal-500/10 border-teal-200/40 text-teal-600 dark:text-teal-400 dark:border-teal-900/60",
      iconBg: "bg-teal-600 text-white shadow-sm shadow-teal-500/10",
      glow: "from-teal-500/5 to-teal-500/0",
    },
    emerald: {
      bg: "bg-emerald-500/10 border-emerald-200/40 text-emerald-600 dark:text-emerald-400 dark:border-emerald-900/60",
      iconBg: "bg-emerald-600 text-white shadow-sm shadow-emerald-500/10",
      glow: "from-emerald-500/5 to-emerald-500/0",
    },
    amber: {
      bg: "bg-amber-500/10 border-amber-200/40 text-amber-600 dark:text-amber-400 dark:border-amber-900/60",
      iconBg: "bg-amber-600 text-white shadow-sm shadow-amber-500/10",
      glow: "from-amber-500/5 to-amber-500/0",
    },
    sky: {
      bg: "bg-sky-500/10 border-sky-200/40 text-sky-600 dark:text-sky-400 dark:border-sky-900/60",
      iconBg: "bg-sky-600 text-white shadow-sm shadow-sky-500/10",
      glow: "from-sky-500/5 to-sky-500/0",
    },
  }[color];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-outline-variant bg-white dark:bg-surface-container p-5 shadow-elevation-1 hover:shadow-elevation-2 hover:scale-[1.01] transition-all duration-300">
      <div className={cn("absolute top-0 right-0 h-16 w-16 bg-gradient-to-br rounded-bl-full", colors.glow)} />
      
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60">{title}</span>
          <p className="text-display-xs font-black text-on-surface leading-none">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", colors.iconBg)}>
          <Icon name={icon} size={20} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <span className="text-body-sm text-on-surface-variant/80 font-medium">{subtitle}</span>
      </div>
    </div>
  );
}

export default function NoticesPage() {
  const snackbar = useSnackbar();
  const { can } = usePermissions();
  const { data: session } = useSession();
  const { branches } = useBranches();

  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingNotice, setEditingNotice] = useState<NoticeRow | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>(["PARENT"]);
  const [branchId, setBranchId] = useState("GLOBAL");
  const [isPublished, setIsPublished] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isGlobalAdmin =
    session?.user?.roleName === "SUPER_ADMIN" ||
    session?.user?.roleName === "SCHOOL_ADMIN";

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notices?limit=9999");
      const data = await res.json();
      if (data.success) {
        setNotices(data.data);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  useEffect(() => {
    if (dialogOpen) {
      if (dialogMode === "edit" && editingNotice) {
        setTitle(editingNotice.title);
        setContent(editingNotice.content);
        setTargetRoles(editingNotice.targetRoles || ["PARENT"]);
        setBranchId(editingNotice.branchId || "GLOBAL");
        const isFuture = editingNotice.publishedAt && new Date(editingNotice.publishedAt) > new Date();
        setIsPublished(editingNotice.isPublished && !isFuture);
        setPublishedAt(editingNotice.publishedAt ? editingNotice.publishedAt.slice(0, 10) : "");
        setExpiresAt(editingNotice.expiresAt ? editingNotice.expiresAt.slice(0, 10) : "");
      } else {
        setTitle("");
        setContent("");
        setTargetRoles(["PARENT"]);
        const userBranch = session?.user?.branchId || "";
        setBranchId(isGlobalAdmin ? "GLOBAL" : userBranch);
        setIsPublished(false);
        setPublishedAt("");
        setExpiresAt("");
      }
      setErrors({});
    }
  }, [dialogOpen, dialogMode, editingNotice, session, isGlobalAdmin]);

  function openCreate() {
    setDialogMode("create");
    setEditingNotice(null);
    setDialogOpen(true);
  }

  function openEdit(notice: NoticeRow) {
    setDialogMode("edit");
    setEditingNotice(notice);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/notices/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Notice deleted successfully", "success");
        fetchNotices();
      } else {
        snackbar.show(data.error?.message ?? "Failed to delete notice", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const formData = {
      title,
      content,
      targetRoles,
      branchId: branchId === "GLOBAL" || !branchId ? null : branchId,
      isPublished,
      publishedAt: isPublished ? null : (publishedAt ? new Date(publishedAt).toISOString() : null),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    if (dialogMode === "create") {
      const result = createNoticeSchema.safeParse(formData);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path.join(".");
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/v1/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create notice", "error");
          return;
        }

        snackbar.show("Notice created successfully", "success");
        setDialogOpen(false);
        fetchNotices();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setSubmitting(false);
      }
    } else {
      const result = updateNoticeSchema.safeParse(formData);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path.join(".");
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch(`/api/v1/notices/${editingNotice!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update notice", "error");
          return;
        }

        snackbar.show("Notice updated successfully", "success");
        setDialogOpen(false);
        fetchNotices();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setSubmitting(false);
      }
    }
  }

  const rolesOptions = [
    { value: "PARENT", label: "Parents" },
    { value: "TEACHER", label: "Teachers" },
    { value: "STUDENT", label: "Students" },
  ];

  const columns: Column<NoticeRow>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <span className="font-semibold text-on-surface truncate max-w-[200px]">
          {row.title}
        </span>
      ),
    },
    {
      key: "content",
      header: "Content Snippet",
      render: (row) => (
        <span className="text-on-surface-variant text-body-sm line-clamp-1 truncate max-w-[320px]">
          {row.content}
        </span>
      ),
    },
    {
      key: "targetRoles",
      header: "Targets",
      render: (row) => {
        const roles = Array.isArray(row.targetRoles) ? row.targetRoles : [];
        return (
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <span
                key={r}
                className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider"
              >
                {r}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) => (
        <span className="text-on-surface text-body-sm font-medium">
          {row.branch?.name || "Global / All Branches"}
        </span>
      ),
    },
    {
      key: "isPublished",
      header: "Status",
      type: "status-dot",
      statusDotConfig: {
        color: (row) => {
          if (!row.isPublished) return "default";
          const isFuture = row.publishedAt && new Date(row.publishedAt) > new Date();
          return isFuture ? "warning" : "success";
        },
        label: (row) => {
          if (!row.isPublished) return "Draft";
          const isFuture = row.publishedAt && new Date(row.publishedAt) > new Date();
          return isFuture ? "Scheduled" : "Published";
        },
      },
    },
    {
      key: "createdAt",
      header: "Created Date",
      type: "date",
      dateConfig: {
        value: (row) => row.createdAt,
      },
    },
    {
      key: "expiresAt",
      header: "Expiry Date",
      type: "date",
      dateConfig: {
        value: (row) => row.expiresAt,
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <Dialog>
          <Menu>
            <MenuTrigger asChild>
              <button
                id={`actions-trigger-${row.id}`}
                type="button"
                className="rounded-full p-1 hover:bg-surface-container-high"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="more_vert" size={20} />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                icon="edit"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(row);
                }}
              >
                Edit
              </MenuItem>
              {can("notices", "delete") && (
                <DialogTrigger asChild>
                  <MenuItem
                    icon="delete"
                    onClick={(e) => e.stopPropagation()}
                    className="text-error"
                  >
                    Delete
                  </MenuItem>
                </DialogTrigger>
              )}
            </MenuContent>
          </Menu>
          <DialogContent>
            <DialogTitle>Delete notice?</DialogTitle>
            <DialogDescription>
              This will permanently delete the notice &ldquo;{row.title}&rdquo;. This action cannot be undone.
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="text">Cancel</Button>
              </DialogClose>
              <Button
                id="confirm-delete-btn"
                variant="filled"
                onClick={() => handleDelete(row.id)}
                loading={deletingId === row.id}
                className="bg-error text-on-error"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ),
      className: "w-12",
    },
  ];

  // Stats calculation
  const totalCount = notices.length;
  const publishedCount = notices.filter((n) => n.isPublished).length;
  const draftCount = notices.filter((n) => !n.isPublished).length;
  const parentTargetCount = notices.filter((n) =>
    Array.isArray(n.targetRoles) && n.targetRoles.includes("PARENT")
  ).length;

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem>Notices</BreadcrumbItem>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface">
            Notice Board Management
          </h1>
          <p className="text-body-sm text-on-surface-variant">
            Create and broadcast notices, bulletins, and announcements across mobile apps and web portals.
          </p>
        </div>
        <PermissionGate module="notices" action="create">
          <Button
            variant="filled"
            icon="campaign"
            onClick={openCreate}
            className="hidden md:inline-flex"
          >
            Create Notice
          </Button>
        </PermissionGate>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <LocalMetricCard
          title="Total Announcements"
          value={totalCount}
          subtitle="All created notices"
          icon="campaign"
          color="sky"
        />
        <LocalMetricCard
          title="Active / Published"
          value={publishedCount}
          subtitle="Visible on portal board"
          icon="check_circle"
          color="emerald"
        />
        <LocalMetricCard
          title="Draft Notices"
          value={draftCount}
          subtitle="Saved drafts not yet visible"
          icon="app_registration"
          color="teal"
        />
        <LocalMetricCard
          title="Targeted to Parents"
          value={parentTargetCount}
          subtitle="Notices visible on Mobile App"
          icon="group"
          color="amber"
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search notices..."
            className="sm:max-w-xs"
          />
        </div>

        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={notices}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => openEdit(row)}
            loading={loading}
            emptyIcon="campaign"
            emptyMessage="No notices found"
            quickFilter={searchInput}
          />
        </div>
      </div>

      <PermissionGate module="notices" action="create">
        <FAB icon="campaign" onClick={openCreate} />
      </PermissionGate>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>
            {dialogMode === "create" ? "Create Notice" : "Edit Notice"}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              placeholder="e.g. Annual Sports Day 2026 Announcement"
              required
              fullWidth
            />

            <div className="relative w-full">
              <label className="block text-label-md text-on-surface-variant mb-1.5 px-1 font-semibold">
                Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
                placeholder="Write notice details and content here..."
                className={cn(
                  "w-full rounded-[8px] border bg-transparent px-4 py-3 text-[16px] text-on-surface outline-none",
                  errors.content ? "border-error focus:border-error" : "border-outline focus:border-primary focus:border-2"
                )}
              />
              {errors.content && (
                <p className="mt-1 px-4 text-[12px] text-error">{errors.content}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-label-md text-on-surface-variant px-1 font-semibold">
                Target Audience *
              </label>
              <div className="flex flex-wrap gap-5 px-1 pt-1">
                {rolesOptions.map((role) => {
                  const isChecked = targetRoles.includes(role.value);
                  return (
                    <label key={role.value} className="flex items-center gap-2 cursor-pointer text-body-medium text-on-surface select-none">
                      <Checkbox
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTargetRoles([...targetRoles, role.value]);
                          } else {
                            setTargetRoles(targetRoles.filter((r) => r !== role.value));
                          }
                        }}
                      />
                      <span>{role.label}</span>
                    </label>
                  );
                })}
              </div>
              {errors.targetRoles && (
                <p className="mt-1 px-1 text-[12px] text-error">{errors.targetRoles}</p>
              )}
            </div>

            {isGlobalAdmin ? (
              <div className="flex flex-col gap-1">
                <label className="text-label-md text-on-surface-variant px-1 font-semibold">
                  Branch / Scope
                </label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger fullWidth>
                    <SelectValue placeholder="Global / All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GLOBAL">Global / All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="px-1 text-body-sm text-on-surface-variant/80 italic">
                Scope locked to: <span className="font-bold">{branches.find(b => b.id === branchId)?.name || "Home Branch"}</span>
              </div>
            )}

            <div className="border-t border-outline-variant/60 my-4" />

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer text-body-medium text-on-surface pt-1 select-none">
                <Checkbox
                  checked={isPublished}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsPublished(checked);
                    if (checked) {
                      setPublishedAt("");
                    }
                  }}
                  className="mt-0.5"
                />
                <div className="flex flex-col -mt-0.5">
                  <span className="font-semibold">Publish immediately</span>
                  <span className="text-body-sm text-on-surface-variant/70">
                    Make this notice visible on parent & teacher portals right away.
                  </span>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Publish Date (Optional)"
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  error={errors.publishedAt}
                  disabled={isPublished}
                  fullWidth
                />
                <TextField
                  label="Expiry Date (Optional)"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  error={errors.expiresAt}
                  fullWidth
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/60">
              <DialogClose asChild>
                <Button type="button" variant="text">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant="filled" loading={submitting}>
                {dialogMode === "create" ? "Create" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
