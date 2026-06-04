"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import { UserForm } from "@/components/users/user-form";
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

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: { id: string; name: string };
  isActive: boolean;
  branch: { id: string; name: string } | null;
}

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/users/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data);
        } else {
          snackbar.show(data.error?.message ?? "User not found", "error");
          router.push("/users");
        }
      })
      .catch(() => {
        snackbar.show("Failed to load user", "error");
        router.push("/users");
      })
      .finally(() => setLoading(false));
  }, [params.id, router, snackbar]);

  async function handleDeactivate() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/users/${params.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        snackbar.show("User deactivated", "success");
        router.push("/users");
        router.refresh();
      } else {
        snackbar.show(data.error?.message ?? "Failed to deactivate user", "error");
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
          <BreadcrumbItem href="/users">Users</BreadcrumbItem>
          <BreadcrumbItem>Edit</BreadcrumbItem>
        </Breadcrumb>
        <h1 className="text-headline-md font-semibold text-on-surface mb-6">
          Edit User
        </h1>
        <FormSkeleton />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/users">Users</BreadcrumbItem>
        <BreadcrumbItem>{user.name}</BreadcrumbItem>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-headline-md font-semibold text-on-surface">
          Edit User
        </h1>
        <PermissionGate module="users" action="delete">
          {user.isActive && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="text"
                  icon="person_off"
                  className="text-error"
                >
                  Deactivate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Deactivate user?</DialogTitle>
                <DialogDescription>
                  Are you sure you want to deactivate this user? They will no
                  longer be able to sign in.
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
      <UserForm mode="edit" initialData={user} />
    </div>
  );
}
