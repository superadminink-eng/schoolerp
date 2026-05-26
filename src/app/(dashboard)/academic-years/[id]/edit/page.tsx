"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { AcademicYearForm } from "@/components/academic-years/academic-year-form";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FormSkeleton } from "@/components/ui/skeleton";

interface AcademicYearData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export default function EditAcademicYearPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [year, setYear] = useState<AcademicYearData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/academic-years/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setYear(data.data);
        } else {
          snackbar.show(data.error?.message ?? "Academic year not found", "error");
          router.push("/academic-years");
        }
      })
      .catch(() => {
        snackbar.show("Failed to load academic year", "error");
        router.push("/academic-years");
      })
      .finally(() => setLoading(false));
  }, [params.id, router, snackbar]);

  if (loading) {
    return (
      <div>
        <Breadcrumb>
          <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
          <BreadcrumbItem href="/academic-years">Academic Years</BreadcrumbItem>
          <BreadcrumbItem>Edit</BreadcrumbItem>
        </Breadcrumb>
        <h1 className="text-headline-md font-semibold text-on-surface mb-6">
          Edit Academic Year
        </h1>
        <FormSkeleton />
      </div>
    );
  }

  if (!year) return null;

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/academic-years">Academic Years</BreadcrumbItem>
        <BreadcrumbItem>Edit</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Edit Academic Year
      </h1>

      <AcademicYearForm mode="edit" initialData={year} />
    </div>
  );
}
