import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { AuthForm } from "@/components/AuthForm";
import { CoachChat } from "@/components/CoachChat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

function App() {
  const { data: session, isPending } = useSession();
  const [online, setOnline] = useState(navigator.onLine);

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
      <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading Devta…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden">
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
      <header className="border-border sticky top-0 z-40 flex items-center justify-between border-b px-4 py-2.5 backdrop-blur">
        <span className="text-[15px] font-semibold tracking-tight">Devta · wingman</span>
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
      <CoachChat />
    </main>
  );
}

export default App;
