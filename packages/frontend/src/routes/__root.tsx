import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { HeartIcon, LogOut, MenuIcon } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { AuthForm } from "@/components/AuthForm";
import { SessionDrawer } from "@/components/SessionDrawer";
import { SplashScreen } from "@/components/SplashScreen";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

function RootShell() {
  const { data: session, isPending } = useSession();
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

  if (isPending) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-md items-center justify-center overflow-hidden">
        {splash && <SplashScreen onDone={hideSplash} />}
        <p className="text-muted-foreground text-sm">Loading devta…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden">
        {splash && <SplashScreen onDone={hideSplash} />}
        <div className="flex justify-end px-4 pt-3">
          <ThemeToggle />
        </div>
        {!online && (
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
            <span className="text-muted-foreground text-[13px]">· wingman</span>
          </span>
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Your connections"
          className="text-rose-500 hover:text-rose-500"
          nativeButton={false}
          render={<Link to="/connections" />}
        >
          <HeartIcon />
        </Button>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${online ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}
          >
            {online ? "Online" : "Offline"}
          </span>
          <ThemeToggle />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Sign out"
            onClick={() => void authClient.signOut()}
          >
            <LogOut />
          </Button>
        </div>
      </header>
      {!online && (
        <p className="bg-amber-500/15 px-4 py-2 text-center text-xs">
          Offline — reading cached chats. Reconnect to continue.
        </p>
      )}
      <SessionDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <Outlet />
    </main>
  );
}

export const Route = createRootRoute({
  component: RootShell,
});
