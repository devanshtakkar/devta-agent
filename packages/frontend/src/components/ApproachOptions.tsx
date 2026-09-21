import { useState } from "react";
import {
  BookmarkCheckIcon,
  BookmarkIcon,
  GitBranchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ApproachToolPart, Starter } from "@/lib/api";
import { RISK_LABELS } from "@/lib/api";
import { removeSavedApproach, useSavedApproaches } from "@/lib/saved-approaches";
import { ScenarioPicker } from "@/components/ScenarioPicker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";

function Loading() {
  return (
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-label="Composing approach options"
    >
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-3">
        <Skeleton className="h-40 w-[82%] shrink-0 rounded-2xl" />
        <Skeleton className="h-40 w-[82%] shrink-0 rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Renders the `proposeApproaches` tool output: an overview line plus a
 * swipeable carousel of ready-to-use openers, each with a single action that
 * brainstorms how the conversation could branch out from that opener.
 */
export function ApproachOptions({
  part,
  onBranch,
  sessionId,
}: {
  part: ApproachToolPart;
  onBranch: (starter: Starter) => void;
  sessionId?: string | null;
}) {
  const saved = useSavedApproaches();
  const [pickerStarter, setPickerStarter] = useState<Starter | null>(null);

  if (part.state === "input-streaming") return <Loading />;
  if (part.state === "output-error") {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>
          {part.errorText || "Couldn't compose options — try again."}
        </AlertDescription>
      </Alert>
    );
  }

  const starters = part.input?.starters ?? [];
  const overview = part.input?.overview;
  if (starters.length === 0) return <Loading />;

  function isSaved(starter: Starter) {
    return saved.some((v) => v.starter.openerLine === starter.openerLine);
  }

  function toggleSave(starter: Starter) {
    const existing = saved.find(
      (s) => s.starter.openerLine === starter.openerLine,
    );
    if (existing) {
      removeSavedApproach(existing.id);
    } else {
      setPickerStarter(starter);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {overview && (
        <p className="text-muted-foreground text-sm leading-snug">{overview}</p>
      )}
      <Carousel className="-mx-4 px-4">
        <CarouselContent className="-ml-3">
          {starters.map((s, i) => (
            <CarouselItem key={s.id} className="max-w-[340px] basis-[82%] py-2 pl-3">
              <Card className="h-full">
                <CardHeader>
                  <CardDescription>
                    Option {i + 1} of {starters.length} · {RISK_LABELS[s.risk] ?? s.risk}
                  </CardDescription>
                  <CardTitle>{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="border-border/60 bg-muted/50 rounded-xl border px-3.5 py-2.5">
                    <p className="text-[15px] leading-snug font-medium">
                      “{s.openerLine}”
                    </p>
                  </div>
                  <p className="text-muted-foreground text-[13px] leading-snug">{s.why}</p>
                  <p className="text-[13px] leading-snug">
                    <span className="font-semibold">Next: </span>
                    {s.nextMove}
                  </p>
                  <p className="text-muted-foreground text-[13px] leading-snug">
                    <span className="font-semibold">Ease out: </span>
                    {s.gracefulExit}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onBranch(s)}
                  >
                    <GitBranchIcon data-icon="inline-start" />
                    Branch out
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={isSaved(s) ? "default" : "outline"}
                    aria-label={isSaved(s) ? "Remove saved approach" : "Save approach"}
                    aria-pressed={isSaved(s)}
                    title={isSaved(s) ? "Saved" : "Save for later"}
                    onClick={() => toggleSave(s)}
                  >
                    {isSaved(s) ? <BookmarkCheckIcon /> : <BookmarkIcon />}
                  </Button>
                </CardFooter>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <ScenarioPicker
        open={pickerStarter !== null}
        onOpenChange={(open) => {
          if (!open) setPickerStarter(null);
        }}
        starter={pickerStarter}
        overview={overview}
        sessionId={sessionId}
      />
    </div>
  );
}
