import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export function AppHeader({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { user, isPending } = useCurrentUserState();
  const initial = (user?.displayName ?? user?.primaryEmail ?? "A").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-xl font-medium tracking-tight">ComEdy</p>
          <p className="whitespace-nowrap text-xs uppercase tracking-widest text-subtle">
            Electricity pricing
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh prices"
            className="sm:hidden"
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            aria-label="Refresh prices"
            className="hidden sm:inline-flex"
          >
            <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
            Refresh
          </Button>
          {isPending ? (
            <div className="size-9 rounded-full bg-surface-2" />
          ) : user ? (
            <button
              type="button"
              onClick={() => {
                if (authEnabled) void signOut();
              }}
              className="pressable grid size-9 place-items-center overflow-hidden rounded-full bg-surface-2 text-sm font-medium"
              title={authEnabled ? "Sign out" : user.displayName ?? "Account"}
            >
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="size-9 object-cover" />
              ) : (
                initial
              )}
            </button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
