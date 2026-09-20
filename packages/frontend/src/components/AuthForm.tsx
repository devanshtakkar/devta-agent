import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message ?? "Sign in failed");
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
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          className="border-input bg-background h-11 rounded-xl border px-3 text-base"
          placeholder="Email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="relative">
          <input
            className="border-input bg-background h-11 w-full rounded-xl border px-3 pr-11 text-base"
            placeholder="Password (8+ chars)"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-1 -translate-y-1/2"
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Please wait…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
