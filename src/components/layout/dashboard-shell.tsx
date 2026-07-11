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
import type { NavItemType } from "@/config/permissions";

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    image?: string | null;
    role: string;
    organizationName: string;
    organizationLogo?: string | null;
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

  const filteredItems = useMemo<NavItemType[]>(() => {
    const filterItems = (items: NavItemType[]): NavItemType[] => {
      return items.reduce<NavItemType[]>((acc, item) => {
        if (item.roles === "all") {
          acc.push(item);
          return acc;
        }

        let hasAccess = false;
        if (item.permission) {
          const permissions = item.permission.split(",");
          hasAccess = permissions.some((perm) => {
            const [module, action] = perm.trim().split(":");
            return can(module, action);
          });
        }

        const filteredChildren = item.children ? filterItems(item.children) : undefined;

        if (hasAccess || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...item, children: filteredChildren });
        }

        return acc;
      }, []);
    };

    return filterItems(NAVIGATION_ITEMS as NavItemType[]);
  }, [can]);

  const pageTitle = deriveTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-dim font-sans text-on-surface print:h-auto print:block print:overflow-visible print:bg-white">
      {/* Persistent drawer — desktop only */}
      <StandardDrawer
        items={filteredItems}
        orgName={user.organizationName}
        orgLogo={user.organizationLogo}
        className="hidden xl:block print:hidden"
      />

      {/* Nav rail — tablet only */}
      <NavRail
        items={filteredItems}
        onMenuClick={() => setDrawerOpen(true)}
        className="hidden md:flex xl:hidden print:hidden"
      />

      {/* Modal drawer — opens from hamburger on mobile/tablet */}
      <ModalDrawer
        items={filteredItems}
        orgName={user.organizationName}
        orgLogo={user.organizationLogo}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0 w-full print:block print:overflow-visible">
        <TopAppBar
          title={pageTitle}
          onMenuClick={() => setDrawerOpen(true)}
          className="print:hidden"
          trailing={
            <>
              <BranchSwitcher />
              <UserMenu
                name={user.name}
                email={user.email}
                image={user.image}
                roleName={user.role}
              />
            </>
          }
        />

        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8 print:p-0 print:max-w-none">{children}</div>
        </main>
      </div>
    </div>
  );
}
