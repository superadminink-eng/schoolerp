"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatsCard } from "@/components/ui/stats-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";

interface Stats {
  students: number;
  staff: number;
  branches: number;
  users: number;
}

function StatsCardSkeleton() {
  return (
    <div className="rounded-[16px] border border-outline-variant bg-surface p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <div>
        <Skeleton className="h-10 w-16 rounded" />
      </div>
    </div>
  );
}

export function DashboardContent() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/dashboard/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.data);
        }
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 mt-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatsCard
              title="Active Students"
              value={stats.students}
              icon="school"
              color="primary"
            />
            <StatsCard
              title="Active Staff"
              value={stats.staff}
              icon="groups"
              color="secondary"
            />
            <StatsCard
              title="Branches"
              value={stats.branches}
              icon="location_city"
              color="tertiary"
            />
            <StatsCard
              title="Users"
              value={stats.users}
              icon="manage_accounts"
              color="primary"
            />
          </>
        ) : null}
      </div>

      {/* Quick Actions */}
      {/* <div className="flex flex-wrap gap-3">
        <PermissionGate module="students" action="create">
          <Button
            variant="tonal"
            icon="person_add"
            onClick={() => router.push("/students/new")}
          >
            Add Student
          </Button>
        </PermissionGate>
        <PermissionGate module="staff" action="create">
          <Button
            variant="tonal"
            icon="group_add"
            onClick={() => router.push("/staff/new")}
          >
            Add Staff
          </Button>
        </PermissionGate>
      </div> */}
    </div>
  );
}
