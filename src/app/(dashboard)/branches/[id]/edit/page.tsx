"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import { BranchForm } from "@/components/branches/branch-form";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FormSkeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

interface BranchData {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isMain: boolean;
  isActive: boolean;
}

export default function EditBranchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [branch, setBranch] = useState<BranchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/branches/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBranch(data.data);
        } else {
          snackbar.show(data.error?.message ?? "Branch not found", "error");
          router.push("/branches");
        }
      })
      .catch(() => {
        snackbar.show("Failed to load branch", "error");
        router.push("/branches");
      })
      .finally(() => setLoading(false));
  }, [params.id, router, snackbar]);

  async function handleDeactivate() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/branches/${params.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Branch deactivated", "success");
        router.push("/branches");
        router.refresh();
      } else {
        snackbar.show(data.error?.message ?? "Failed to deactivate branch", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb>
          <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
          <BreadcrumbItem href="/branches">Branches</BreadcrumbItem>
          <BreadcrumbItem>Edit</BreadcrumbItem>
        </Breadcrumb>
        <h1 className="text-headline-md font-semibold text-on-surface mb-6">
          Edit Branch
        </h1>
        <FormSkeleton />
      </div>
    );
  }

  if (!branch) return null;

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/branches">Branches</BreadcrumbItem>
        <BreadcrumbItem>{branch.name}</BreadcrumbItem>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-headline-md font-semibold text-on-surface">
          Edit Branch
        </h1>
        <PermissionGate module="branches" action="manage">
          {branch.isActive && !branch.isMain && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="text"
                  icon="domain_disabled"
                  className="text-error"
                >
                  Deactivate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Deactivate branch?</DialogTitle>
                <DialogDescription>
                  Are you sure you want to deactivate this branch? This action
                  can be reversed later.
                </DialogDescription>
                <div className="mt-6 flex justify-end gap-3">
                  <DialogClose asChild>
                    <Button variant="text">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="filled"
                    onClick={handleDeactivate}
                    loading={deleting}
                    className="bg-error text-on-error"
                  >
                    Deactivate
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </PermissionGate>
      </div>
      <BranchForm mode="edit" initialData={branch} />
    </div>
  );
}
