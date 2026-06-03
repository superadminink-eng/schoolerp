"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import * as Select from "@radix-ui/react-select";
import { Icon } from "@/components/ui/icon";
import { useBranches } from "@/hooks/use-branches";
import { cn } from "@/lib/utils";

export function BranchSwitcher() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const { branches, isLoading } = useBranches();

  const role = session?.user?.roleName;
  const currentBranchId = session?.user?.branchId ?? "";

  // Only SCHOOL_ADMIN (and SUPER_ADMIN) can switch branches
  if (isLoading || branches.length <= 1 || role === "BRANCH_ADMIN") return null;

  async function handleBranchChange(branchId: string) {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;

    await update({
      branchId: branch.id,
      branchName: branch.name,
    });

    router.refresh();
  }

  return (
    <Select.Root value={currentBranchId} onValueChange={handleBranchChange}>
      <Select.Trigger
        className={cn(
          "state-layer focus-ring inline-flex items-center gap-2 rounded-sm px-3 py-1.5",
          "bg-surface-container text-on-surface text-label-lg",
          "border border-outline-variant after:bg-on-surface-variant"
        )}
        aria-label="Switch branch"
      >
        <Icon name="location_city" size={18} />
        <Select.Value />
        <Select.Icon>
          <Icon name="expand_more" size={18} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="z-50 overflow-hidden rounded-sm bg-surface-container shadow-elevation-2"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-1">
            {branches.map((branch) => (
              <Select.Item
                key={branch.id}
                value={branch.id}
                className={cn(
                  "state-layer focus-ring relative flex cursor-pointer items-center gap-2 rounded-xs px-3 py-2 text-body-md text-on-surface outline-none after:bg-on-surface",
                  "data-[highlighted]:bg-on-surface/8"
                )}
              >
                <Select.ItemText>{branch.name}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto">
                  <Icon name="check" size={18} className="text-primary" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
