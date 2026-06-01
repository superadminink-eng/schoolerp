import { auth } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-headline-md font-semibold text-on-surface mb-2">
        Dashboard
      </h1>
      <p className="text-body-lg text-on-surface-variant">
        Welcome back, {session?.user.name}. You are logged in as{" "}
        <span className="font-medium text-primary">
          {session?.user.roleName?.replace("_", " ")}
        </span>{" "}
        at {session?.user.organizationName}.
      </p>
      <DashboardContent />
    </div>
  );
}
