import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "sign-up") {
        const { error } = await authClient.signUp.email({ name: name || email, email, password });
        if (error) throw new Error(error.message ?? "Sign up failed");
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message ?? "Sign in failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Devta</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your in-the-moment wingman. Sign in to get openers in seconds.
        </p>
      </div>
      <div className="flex gap-2">
        {(["sign-in", "sign-up"] as const).map((m) => (
          <Button
            key={m}
            type="button"
            variant={mode === m ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(m)}
          >
            {m === "sign-in" ? "Sign in" : "Sign up"}
          </Button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "sign-up" && (
          <input
            className="border-input bg-background h-11 rounded-xl border px-3 text-base"
            placeholder="Name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="border-input bg-background h-11 rounded-xl border px-3 text-base"
          placeholder="Email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border-input bg-background h-11 rounded-xl border px-3 text-base"
          placeholder="Password (8+ chars)"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="text-muted-foreground text-xs">
        Email + password only. Verification / reset links arrive from your SMTP sender.
      </p>
    </div>
  );
}
