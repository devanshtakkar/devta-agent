import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { suggestScenario, type Starter } from "@/lib/api";
import {
  saveApproach,
  SCENARIO_PRESETS,
  useSavedApproaches,
} from "@/lib/saved-approaches";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";

/**
 * Bottom sheet shown when bookmarking an approach: pick the scenario it
 * belongs to, or let the AI name one from the conversation context. Saving
 * needs no network for the preset/existing chips.
 */
export function ScenarioPicker({
  open,
  onOpenChange,
  starter,
  overview,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  starter: Starter | null;
  overview?: string;
  sessionId?: string | null;
}) {
  const saved = useSavedApproaches();

  const { existing, scenarios } = useMemo(() => {
    const existing = new Set(saved.map((item) => item.scenario));
    const names: string[] = [];
    const seen = new Set<string>();
    // Existing groups first (most recently used), then presets not yet used.
    for (const item of saved) {
      if (seen.has(item.scenario)) continue;
      seen.add(item.scenario);
      names.push(item.scenario);
    }
    for (const preset of SCENARIO_PRESETS) {
      if (seen.has(preset)) continue;
      seen.add(preset);
      names.push(preset);
    }
    return { existing, scenarios: names };
  }, [saved]);

  const suggest = useMutation({
    mutationFn: () => {
      if (!starter) throw new Error("No approach selected");
      return suggestScenario({
        starter: {
          title: starter.title,
          openerLine: starter.openerLine,
          why: starter.why,
          nextMove: starter.nextMove,
          gracefulExit: starter.gracefulExit,
        },
        overview,
        sessionId: sessionId ?? undefined,
        existing: scenarios.filter((s) => existing.has(s)),
      });
    },
    onSuccess: (scenario) => {
      if (!starter) return;
      saveApproach(starter, {
        scenario,
        overview,
        sessionId: sessionId ?? undefined,
      });
      onOpenChange(false);
    },
  });

  function choose(scenario: string) {
    if (!starter) return;
    saveApproach(starter, {
      scenario,
      overview,
      sessionId: sessionId ?? undefined,
    });
    onOpenChange(false);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) suggest.reset();
        onOpenChange(o);
      }}
      showSwipeHandle
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Save to scenario</DrawerTitle>
          <DrawerDescription className="line-clamp-2">
            {starter
              ? `“${starter.openerLine}”`
              : "Pick the scenario this opener belongs to."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap justify-center gap-2">
            {scenarios.map((scenario) => (
              <Button
                key={scenario}
                type="button"
                size="sm"
                variant={existing.has(scenario) ? "secondary" : "outline"}
                className="rounded-full"
                disabled={!starter || suggest.isPending}
                onClick={() => choose(scenario)}
              >
                {scenario}
              </Button>
            ))}
          </div>
          {suggest.isError && (
            <p className="text-destructive mt-3 text-center text-xs">
              Couldn&apos;t name it with AI — pick one above or try again.
            </p>
          )}
        </div>

        <DrawerFooter>
          <Button
            type="button"
            className="w-full"
            disabled={!starter || suggest.isPending}
            onClick={() => suggest.mutate()}
          >
            {suggest.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SparklesIcon data-icon="inline-start" />
            )}
            {suggest.isPending ? "Naming the scenario…" : "Generate with AI"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
