"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { StaffForm } from "@/components/staff/staff-form";
import { StaffDocuments } from "@/components/staff/staff-documents";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FormSkeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface StaffData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  qualification: string | null;
  joinDate: string;
  status: string;
  branch: { id: string; name: string };
}

export default function EditStaffPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [staff, setStaff] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/staff/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStaff(data.data);
        } else {
          snackbar.show(data.error?.message ?? "Staff member not found", "error");
          router.push("/staff");
        }
      })
      .catch(() => {
        snackbar.show("Failed to load staff member", "error");
        router.push("/staff");
      })
      .finally(() => setLoading(false));
  }, [params.id, router, snackbar]);

  if (loading) {
    return (
      <div>
        <Breadcrumb>
          <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
          <BreadcrumbItem href="/staff">Staff</BreadcrumbItem>
          <BreadcrumbItem>Edit</BreadcrumbItem>
        </Breadcrumb>
        <h1 className="text-headline-md font-semibold text-on-surface mb-6">
          Edit Staff Member
        </h1>
        <FormSkeleton />
      </div>
    );
  }

  if (!staff) return null;

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/staff">Staff</BreadcrumbItem>
        <BreadcrumbItem>{staff.name}</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Edit Staff Member
      </h1>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <StaffForm mode="edit" initialData={staff} />
        </TabsContent>
        <TabsContent value="documents">
          <StaffDocuments staffId={staff.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
