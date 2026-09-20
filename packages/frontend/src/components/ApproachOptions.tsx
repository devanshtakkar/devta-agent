import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import type { ApproachToolPart, Starter } from "@/lib/api";
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

const RISK_LABEL: Record<Starter["risk"], string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "Higher risk",
};

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
 * drops it into the composer so the user can add their own context.
 */
export function ApproachOptions({
  part,
  onUse,
}: {
  part: ApproachToolPart;
  onUse: (starter: Starter) => void;
}) {
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
                    Option {i + 1} of {starters.length} · {RISK_LABEL[s.risk] ?? s.risk}
                  </CardDescription>
                  <CardTitle>{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
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
                </CardContent>
                <CardFooter>
                  <Button size="sm" className="w-full" onClick={() => onUse(s)}>
                    <CheckIcon data-icon="inline-start" />
                    Use this
                  </Button>
                </CardFooter>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
