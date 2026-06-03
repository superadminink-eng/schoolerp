"use client";

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { NAVIGATION_ITEMS } from "@/config/permissions";
import { StandardDrawer, ModalDrawer } from "./navigation-drawer";
import { NavRail } from "./nav-rail";
import { TopAppBar } from "./top-app-bar";
import { BranchSwitcher } from "./branch-switcher";
import { UserMenu } from "./user-menu";
import type { NavItemData } from "./nav-item";

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    image?: string | null;
    role: string;
    organizationName: string;
  };
}

function deriveTitle(pathname: string): string {
  // Match first segment after leading slash
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { can } = usePermissions();

  const filteredItems = useMemo<NavItemData[]>(() => {
    return NAVIGATION_ITEMS.filter((item) => {
      if ("roles" in item && item.roles === "all") return true;
      if ("permission" in item && item.permission) {
        const [module, action] = item.permission.split(":");
        return can(module, action);
      }
      return false;
    }).map(({ label, href, icon }) => ({ label, href, icon }));
  }, [can]);

  const pageTitle = deriveTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Persistent drawer — desktop only */}
      <StandardDrawer
        items={filteredItems}
        orgName={user.organizationName}
        className="hidden xl:block"
      />

      {/* Nav rail — tablet only */}
      <NavRail
        items={filteredItems}
        onMenuClick={() => setDrawerOpen(true)}
        className="hidden md:flex xl:hidden"
      />

      {/* Modal drawer — opens from hamburger on mobile/tablet */}
      <ModalDrawer
        items={filteredItems}
        orgName={user.organizationName}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopAppBar
          title={pageTitle}
          onMenuClick={() => setDrawerOpen(true)}
          trailing={
            <>
              <BranchSwitcher />
              <UserMenu
                name={user.name}
                email={user.email}
                image={user.image}
              />
            </>
          }
        />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-6 lg:p-10">{children}</div>
        </main>      </div>
    </div>
  );
}
