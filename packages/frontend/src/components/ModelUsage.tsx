import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { GaugeIcon } from "lucide-react";
import { cn } from "cn";
import {
  getCurrentModel,
  getSession,
  modelsKeys,
  sessionsKeys,
  type TokenUsage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

const numberFormat = new Intl.NumberFormat("en-US");

function formatTokens(n: number): string {
  return numberFormat.format(n);
}

export function ModelUsage() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sessionId = pathname.startsWith("/s/") ? pathname.slice(3) : null;

  const modelQuery = useQuery({
    queryKey: modelsKeys.current,
    queryFn: getCurrentModel,
    staleTime: 5 * 60_000,
  });

  const detailQuery = useQuery({
    queryKey: sessionsKeys.detail(sessionId ?? ""),
    queryFn: () => getSession(sessionId ?? ""),
    enabled: sessionId !== null,
    staleTime: 10_000,
  });

  const usage: TokenUsage | null | undefined = detailQuery.data?.usage;
  const model = modelQuery.data?.model ?? usage?.model;
  const contextLength = modelQuery.data?.contextLength ?? usage?.contextLength;
  const used = usage?.inputTokens ?? 0;
  const percent = contextLength
    ? Math.min(100, Math.round((used / contextLength) * 100))
    : 0;
  const remaining = contextLength ? Math.max(0, contextLength - used) : undefined;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="tabular-nums"
        aria-label="Show context window usage"
        aria-haspopup="dialog"
        title="Context window used"
        onClick={() => setOpen(true)}
      >
        <GaugeIcon />
        {contextLength ? `${percent}%` : "—"}
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          className="p-0"
          style={{ borderRadius: "1.5rem" }}
        >
          <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <DrawerTitle className="font-heading text-lg font-semibold">
              Context window
            </DrawerTitle>
            <DrawerDescription className="mt-0.5">
              {sessionId
                ? "Prompt tokens this chat has used against the model's limit."
                : "Start a chat to see its context usage."}
            </DrawerDescription>

            <div className="mt-4">
              <div className="flex items-end justify-between gap-2">
                <span className="text-2xl font-semibold tabular-nums">
                  {formatTokens(used)}
                  {contextLength ? (
                    <span className="text-muted-foreground text-sm font-normal">
                      {` / ${formatTokens(contextLength)}`}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {percent}%
                </span>
              </div>
              <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    percent >= 90
                      ? "bg-destructive"
                      : percent >= 70
                        ? "bg-amber-500"
                        : "bg-primary",
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="border-border rounded-xl border px-3 py-2">
                <dt className="text-muted-foreground text-xs">Model</dt>
                <dd className="mt-0.5 truncate font-medium" title={model}>
                  {model ?? "Unknown"}
                </dd>
              </div>
              <div className="border-border rounded-xl border px-3 py-2">
                <dt className="text-muted-foreground text-xs">Remaining</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {remaining === undefined ? "—" : formatTokens(remaining)}
                </dd>
              </div>
              <div className="border-border rounded-xl border px-3 py-2">
                <dt className="text-muted-foreground text-xs">Output (last reply)</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatTokens(usage?.outputTokens ?? 0)}
                </dd>
              </div>
              <div className="border-border rounded-xl border px-3 py-2">
                <dt className="text-muted-foreground text-xs">Total billed</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatTokens(usage?.totalTokens ?? 0)}
                </dd>
              </div>
            </dl>

            {modelQuery.isError && !usage && (
              <p className="text-muted-foreground mt-3 text-xs">
                Couldn&apos;t reach the model info service.
              </p>
            )}
            <p className="text-muted-foreground mt-3 text-xs">
              Updates after each reply. &ldquo;Used&rdquo; is the prompt size sent on
              the last turn.
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
