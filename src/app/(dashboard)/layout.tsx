import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PermissionsProvider } from "@/hooks/use-permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch fresh organization data to prevent stale NextAuth cookies from showing a deleted old logo
  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true, logo: true },
  });

  return (
    <PermissionsProvider>
      <DashboardShell
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          role: session.user.roleName,
          organizationName: organization?.name || session.user.organizationName,
          organizationLogo: organization?.logo || session.user.organizationLogo,
        }}
      >
        {children}
      </DashboardShell>
    </PermissionsProvider>
  );
}
