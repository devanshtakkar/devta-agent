import { useState } from "react";
import { fetchBranch, type BranchResponse, type Starter } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RISK_STYLE: Record<Starter["risk"], string> = {
  low: "bg-emerald-500/15 text-emerald-600",
  medium: "bg-amber-500/15 text-amber-600",
  high: "bg-rose-500/15 text-rose-600",
};

export function StarterCarousel({
  situation,
  starters,
  onUse,
}: {
  situation: string;
  starters: Starter[];
  onUse: (s: Starter) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [branch, setBranch] = useState<BranchResponse | null>(null);
  const [branchFor, setBranchFor] = useState<Starter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openBranch(starter: Starter) {
    setActiveId(starter.id);
    setBranchFor(starter);
    setBranch(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetchBranch(situation, starter);
      setBranch(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Branch failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* swipeable cards */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {starters.map((s, i) => (
          <article
            key={s.id}
            className="border-border bg-card w-[82%] max-w-[340px] shrink-0 snap-center rounded-2xl border p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                Option {i + 1}/{starters.length}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", RISK_STYLE[s.risk])}>
                {s.risk} key
              </span>
            </div>
            <h3 className="mt-1 text-base font-semibold">{s.title}</h3>
            <p className="bg-muted mt-2 rounded-xl p-2.5 text-[15px] leading-snug font-medium">
              “{s.openerLine}”
            </p>
            <p className="text-muted-foreground mt-2 text-[13px] leading-snug">{s.why}</p>
            <p className="mt-1 text-[13px]">
              <span className="font-semibold">Next: </span>
              {s.nextMove}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => openBranch(s)}>
                Branch ▶
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onUse(s)}>
                Use this
              </Button>
            </div>
          </article>
        ))}
      </div>

      {/* branch sheet */}
      {activeId && (
        <div className="border-border bg-background fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t p-4 shadow-2xl">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              {branchFor ? `If you open with: “${branchFor.openerLine}”` : "Branch"}
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setActiveId(null)}>
              Close
            </Button>
          </div>
          {loading && <p className="text-muted-foreground py-6 text-center text-sm">Preparing likely replies…</p>}
          {error && <p className="text-destructive py-4 text-sm">{error}</p>}
          {branch && (
            <div className="mt-2 flex flex-col gap-3 pb-6">
              {branch.scenarios.map((sc, i) => (
                <div key={i} className="border-border rounded-2xl border p-3">
                  <p className="text-xs font-semibold tracking-wide uppercase opacity-60">
                    If she says {i + 1}
                  </p>
                  <p className="mt-0.5 text-sm italic">“{sc.herResponse}”</p>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">You: </span>
                    {sc.yourReply}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">{sc.tip}</p>
                </div>
              ))}
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-sm">
                <span className="font-semibold">Graceful exit: </span>
                {branch.exitLine}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
