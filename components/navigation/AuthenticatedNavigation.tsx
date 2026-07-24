import type { ReactNode } from "react";
import { getCurrentAppUser } from "@/lib/auth/getCurrentAppUser";
import { AppNavigationShell } from "./AppNavigationShell";

type AuthenticatedNavigationProps = {
  children: ReactNode;
};

export async function AuthenticatedNavigation({
  children,
}: AuthenticatedNavigationProps) {
  const currentUser = await getCurrentAppUser();

  // Public pages such as /login remain outside the application shell.
  if (!currentUser) {
    return <>{children}</>;
  }

  return (
    <AppNavigationShell
      role={currentUser.role}
      displayName={currentUser.displayName}
    >
      {children}
    </AppNavigationShell>
  );
}
