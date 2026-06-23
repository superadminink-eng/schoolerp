"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/ui/search-bar";
import { DataTable } from "@/components/ui/lazy-table";
import type { Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Icon } from "@/components/ui/icon";
import { useApi } from "@/hooks/use-api";
import { Pagination } from "@/components/ui/pagination";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { useSnackbar } from "@/components/ui/snackbar";


interface BranchRow {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const snackbar = useSnackbar();

  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Transfer Headquarters State
  const [transferBranch, setTransferBranch] = useState<BranchRow | null>(null);
  const [transferInput, setTransferInput] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchInput]);

  const params = new URLSearchParams();
  params.set("paginated", "true");
  params.set("page", page.toString());
  params.set("limit", limit.toString());
  if (searchInput) params.set("search", searchInput);

  const { data: apiResponse, isLoading: loading, mutate } = useApi<BranchRow[]>(
    `/api/v1/branches?${params.toString()}`
  );

  const branches = apiResponse?.data ?? [];
  const totalItems = apiResponse?.meta?.total ?? 0;

  const columns: Column<BranchRow>[] = [
    {
      key: "name",
      header: "Name",
    },
    {
      key: "code",
      header: "Code",
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => row.phone ?? "—",
    },
    {
      key: "email",
      header: "Email",
      render: (row) => row.email ?? "—",
    },
    {
      key: "isMain",
      header: "Main",
      type: "star-badge",
      starConfig: {
        active: (row) => row.isMain,
        label: "Main",
      },
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
                router.push(`/branches/${row.id}/edit`);
              }}
            >
              Edit
            </MenuItem>
            {!row.isMain && (session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN") && (
              <MenuItem
                icon="star"
                onClick={(e) => {
                  e.stopPropagation();
                  setTransferBranch(row);
                  setTransferInput("");
                }}
              >
                Set as Headquarters
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      ),
      className: "w-12",
    },
  ];

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem>Branches</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Branches
      </h1>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search branches"
            className="sm:max-w-xs"
          />
          <PermissionGate module="branches" action="manage">
            <Button
              variant="filled"
              icon="add"
              onClick={() => router.push("/branches/new")}
              className="hidden md:inline-flex"
            >
              Add Branch
            </Button>
          </PermissionGate>
        </div>

        {/* Table */}
        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={branches}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => router.push(`/branches/${row.id}/edit`)}
            loading={loading}
            emptyIcon="location_off"
            emptyMessage="No branches found"
          />
        </div>

        <Pagination
          currentPage={page}
          totalItems={totalItems}
          itemsPerPage={limit}
          onPageChange={setPage}
          loading={loading}
        />
      </div>

      <PermissionGate module="branches" action="manage">
        <FAB icon="add" onClick={() => router.push("/branches/new")} />
      </PermissionGate>

      {/* Transfer Headquarters Modal */}
      <Dialog open={!!transferBranch} onOpenChange={(open) => !open && setTransferBranch(null)}>
        <DialogContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
              <Icon name="warning" size={24} />
            </div>
            <div>
              <DialogTitle className="text-error">Transfer Headquarters</DialogTitle>
            </div>
          </div>
          
          <DialogDescription className="text-on-surface mb-6 text-base">
            You are about to set <strong>{transferBranch?.name}</strong> as the Main Branch (Headquarters).
            <br /><br />
            <span className="text-error font-medium">Warning:</span> Changing the Headquarters will update the official contact address on all your global systems. The current Main Branch will be demoted to a regular branch.
          </DialogDescription>

          <div className="mb-8">
            <TextField
              label="Type 'TRANSFER' to confirm"
              value={transferInput}
              onChange={(e) => setTransferInput(e.target.value)}
              placeholder="TRANSFER"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outlined"
              onClick={() => setTransferBranch(null)}
              disabled={isTransferring || isSuccess}
            >
              Cancel
            </Button>
            <Button
              variant="filled"
              className={isSuccess ? "bg-success hover:bg-success/90 text-on-success" : "bg-error hover:bg-error/90 text-on-error"}
              disabled={transferInput !== "TRANSFER" || isTransferring || isSuccess}
              loading={isTransferring && !isSuccess}
              icon={isSuccess ? "check" : undefined}
              onClick={async () => {
                if (!transferBranch) return;
                setIsTransferring(true);
                try {
                  const res = await fetch(`/api/v1/branches/${transferBranch.id}/main`, {
                    method: "PUT",
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error?.message || "Failed to transfer");
                  
                  // 1. TRUE OPTIMISTIC UI: Instantly update the local SWR cache data 
                  // so the table reflects the change BEFORE the background fetch finishes.
                  mutate(
                    (currentData: any) => {
                      if (!currentData || !currentData.data) return currentData;
                      return {
                        ...currentData,
                        data: currentData.data.map((branch: any) => ({
                          ...branch,
                          isMain: branch.id === transferBranch.id ? true : false,
                        })),
                      };
                    },
                    { revalidate: true } // Fetch quietly in background to confirm
                  );

                  // 2. Success State (Morph Button)
                  setIsTransferring(false);
                  setIsSuccess(true);
                  snackbar.show("Headquarters successfully transferred", "success");
                  
                  // 3. Psychological Delay (800ms) - let user see the green checkmark
                  await new Promise((resolve) => setTimeout(resolve, 800));
                  
                  // 4. Close modal smoothly
                  setTransferBranch(null);
                  
                  // Reset success state after modal closes smoothly
                  setTimeout(() => setIsSuccess(false), 300);
                } catch (err: any) {
                  snackbar.show(err.message, "error");
                  setIsTransferring(false);
                  setIsSuccess(false);
                }
              }}
            >
              {isSuccess ? "Success!" : "Confirm Transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
