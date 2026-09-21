import { GitBranchIcon, TriangleAlertIcon } from "lucide-react";
import type { BranchToolPart } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
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
      aria-label="Brainstorming branch scenarios"
    >
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-3">
        <Skeleton className="h-40 w-[82%] shrink-0 rounded-2xl" />
        <Skeleton className="h-40 w-[82%] shrink-0 rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Renders the `proposeBranches` tool output: ready-made scenarios for how the
 * conversation can branch out after a chosen opener, so the user is prepared
 * in advance for however she reacts.
 */
export function BranchScenarios({ part }: { part: BranchToolPart }) {
  if (part.state === "input-streaming") return <Loading />;
  if (part.state === "output-error") {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>
          {part.errorText || "Couldn't brainstorm branches — try again."}
        </AlertDescription>
      </Alert>
    );
  }

  const branches = part.input?.branches ?? [];
  if (branches.length === 0) return <Loading />;

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <p className="text-muted-foreground flex items-center gap-1.5 text-sm leading-snug">
        <GitBranchIcon className="size-4 shrink-0" />
        How this could branch out
      </p>
      <Carousel className="-mx-4 px-4">
        <CarouselContent className="-ml-3">
          {branches.map((b, i) => (
            <CarouselItem key={b.id} className="max-w-[340px] basis-[82%] py-2 pl-3">
              <Card className="h-full">
                <CardHeader>
                  <CardDescription>
                    Scenario {i + 1} of {branches.length}
                  </CardDescription>
                  <CardTitle>{b.reaction}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-muted-foreground text-[13px] leading-snug">{b.read}</p>
                  <div className="border-border/60 bg-muted/50 rounded-xl border px-3.5 py-2.5">
                    <p className="text-[15px] leading-snug font-medium">{b.move}</p>
                  </div>
                  <p className="text-[13px] leading-snug">
                    <span className="font-semibold">Leads to: </span>
                    {b.outcome}
                  </p>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
