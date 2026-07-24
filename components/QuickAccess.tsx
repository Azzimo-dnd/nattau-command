import { HomeShortcuts } from "@/components/home/HomeShortcuts";

// Compatibility wrapper for older imports. The new Command Center uses
// HomeShortcuts directly, but this keeps any remaining <QuickAccess /> usage safe.
export function QuickAccess() {
  return <HomeShortcuts />;
}

export default QuickAccess;
