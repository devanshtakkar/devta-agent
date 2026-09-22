import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { BookmarkIcon, HeartIcon, LogOut, MenuIcon } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import {
  clearCachedAuth,
  setCachedAuth,
  useCachedAuth,
} from "@/lib/auth-cache";
import { clearSavedApproachCache } from "@/lib/saved-approaches";
import { AuthForm } from "@/components/AuthForm";
import { SessionDrawer } from "@/components/SessionDrawer";
import { SplashScreen } from "@/components/SplashScreen";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ModelUsage } from "@/components/ModelUsage";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function RootShell() {
  const { data: session, isPending, error } = useSession();
  const cachedAuth = useCachedAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [splash, setSplash] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hideSplash = useCallback(() => setSplash(false), []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Remember that this device signed in so the shell stays reachable offline.
  // Only a definitive answer from the server (no session, or 401) clears it —
  // never a network failure.
  useEffect(() => {
    if (session) {
      setCachedAuth(true);
      return;
    }
    if (isPending || !online) return;
    if (!error || error.status === 401) clearCachedAuth();
  }, [session, isPending, error, online]);

  const offline = !online;
  // With a past sign-in on this device, an offline/unreachable session check
  // shouldn't block the shell; saved approaches live on the device.
  const allowOffline = cachedAuth && (offline || !!error);
  const authed = !!session || allowOffline;

  if (isPending && !allowOffline) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-md items-center justify-center overflow-hidden">
        {splash && <SplashScreen onDone={hideSplash} />}
        <p className="text-muted-foreground text-sm">Loading devta…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden">
        {splash && <SplashScreen onDone={hideSplash} />}
        <div className="flex justify-end px-4 pt-3">
          <ThemeToggle />
        </div>
        {offline && (
          <p className="bg-amber-500/15 px-4 py-2 text-center text-xs">
            Offline — sign-in needs internet.
          </p>
        )}
        <AuthForm />
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden">
      {splash && <SplashScreen onDone={hideSplash} />}
      <header className="border-border sticky top-0 z-40 flex items-center justify-between border-b px-4 py-2.5 backdrop-blur">
        <span className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Open chats"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </Button>
          <span className="flex items-baseline gap-1.5">
            <span className="font-logo text-xl leading-none">devta</span>
          </span>
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Connections"
            nativeButton={false}
            render={<Link to="/connections" />}
          >
            <HeartIcon />
          </Button>
          <ModelUsage />
          <ThemeToggle />
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button size="icon-sm" variant="ghost" aria-label="Sign out" />
              }
            >
              <LogOut />
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out?</AlertDialogTitle>
                <AlertDialogDescription>
                  You&apos;ll return to the sign-in screen. Your saved chats
                  stay on your account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    clearCachedAuth();
                    clearSavedApproachCache();
                    void authClient.signOut();
                  }}
                >
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>
      {offline && (
        <div className="bg-amber-500/15 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-2 text-center text-xs">
          <span>Offline — saved approaches work, chats need a connection.</span>
          <Link
            to="/saved"
            className="font-medium underline underline-offset-2"
          >
            <BookmarkIcon className="mr-1 inline size-3" />
            Open saved approaches
          </Link>
        </div>
      )}
      <SessionDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <Outlet />
    </main>
  );
}

export const Route = createRootRoute({
  component: RootShell,
});
