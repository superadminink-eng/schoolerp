"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Avatar from "@radix-ui/react-avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { useState, useEffect } from "react";

interface UserMenuProps {
  name: string;
  email: string;
  image?: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ name, email, image }: UserMenuProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-label-lg font-medium text-on-primary">
        {getInitials(name)}
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="focus-ring flex items-center rounded-full outline-none"
        aria-label="User menu"
      >
        <Avatar.Root className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary">
          <Avatar.Image
            src={image ?? undefined}
            alt={name}
            className="h-full w-full object-cover"
          />
          <Avatar.Fallback className="text-label-lg font-medium text-on-primary">
            {getInitials(name)}
          </Avatar.Fallback>
        </Avatar.Root>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[220px] rounded-md bg-surface-container shadow-elevation-2"
        >
          {/* User info header */}
          <div className="border-b border-outline-variant px-4 py-3">
            <p className="text-title-sm font-medium text-on-surface">
              {name}
            </p>
            <p className="mt-0.5 text-body-sm text-on-surface-variant">
              {email}
            </p>
          </div>

          <div className="p-1">
            <DropdownMenu.Item
              className={cn(
                "state-layer focus-ring flex cursor-pointer items-center gap-3 rounded-xs px-3 py-2 text-body-md text-on-surface outline-none after:bg-on-surface",
                "data-[highlighted]:bg-on-surface/8"
              )}
              onSelect={() => router.push("/profile")}
            >
              <Icon name="person" size={20} className="text-on-surface-variant" />
              Profile
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-outline-variant" />

            <DropdownMenu.Item
              className={cn(
                "state-layer focus-ring flex cursor-pointer items-center gap-3 rounded-xs px-3 py-2 text-body-md text-on-surface outline-none after:bg-on-surface",
                "data-[highlighted]:bg-on-surface/8"
              )}
              onSelect={() => signOut({ callbackUrl: "/login" })}
            >
              <Icon name="logout" size={20} className="text-on-surface-variant" />
              Sign out
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
