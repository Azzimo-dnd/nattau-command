import type { ReactNode } from "react";
import { getCurrentAppUser } from "@/lib/auth/getCurrentAppUser";
import { loadUserCampaignAccess } from "@/lib/campaigns/loadUserCampaigns";
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

  const campaignAccess = await loadUserCampaignAccess();

  return (
    <AppNavigationShell
      role={currentUser.role}
      displayName={currentUser.displayName}
      campaigns={campaignAccess?.campaigns ?? []}
    >
      {children}
    </AppNavigationShell>
  );
}
