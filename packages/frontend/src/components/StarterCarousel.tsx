import { useState } from "react";
import { CheckIcon, GitBranchIcon, TriangleAlertIcon } from "lucide-react";
import { fetchBranch, type BranchResponse, type Starter } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";

const RISK_VARIANT: Record<Starter["risk"], "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
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
    <div className="min-w-0">
      <Carousel className="-mx-4 px-4">
        <CarouselContent className="-ml-3">
          {starters.map((s, i) => (
            <CarouselItem key={s.id} className="max-w-[340px] basis-[82%] pl-3">
              <Card className="h-full">
                <CardHeader>
                  <CardDescription>
                    Option {i + 1} of {starters.length}
                  </CardDescription>
                  <CardAction>
                    <Badge variant={RISK_VARIANT[s.risk]}>{s.risk} key</Badge>
                  </CardAction>
                  <CardTitle>{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Bubble variant="muted" align="start">
                    <BubbleContent>“{s.openerLine}”</BubbleContent>
                  </Bubble>
                  <p className="text-muted-foreground text-[13px] leading-snug">{s.why}</p>
                  <p className="text-[13px]">
                    <span className="font-semibold">Next: </span>
                    {s.nextMove}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button size="sm" className="flex-1" onClick={() => openBranch(s)}>
                    <GitBranchIcon data-icon="inline-start" />
                    Branch
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => onUse(s)}>
                    <CheckIcon data-icon="inline-start" />
                    Use this
                  </Button>
                </CardFooter>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <Drawer
        open={activeId !== null}
        onOpenChange={(open) => {
          if (!open) setActiveId(null);
        }}
        showSwipeHandle
      >
        <DrawerContent className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>
              {branchFor ? `If you open with: “${branchFor.openerLine}”` : "Branch"}
            </DrawerTitle>
            <DrawerDescription>Likely replies, your next move, plus a graceful exit.</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            {loading && (
              <div className="flex flex-col gap-2 py-2" role="status" aria-label="Loading replies">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {branch && (
              <div className="flex flex-col gap-3">
                {branch.scenarios.map((sc, i) => (
                  <Card key={i} size="sm">
                    <CardHeader>
                      <CardDescription>If she says {i + 1}</CardDescription>
                      <CardTitle className="text-[15px] font-normal italic">
                        “{sc.herResponse}”
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1">
                      <p className="text-sm">
                        <span className="font-semibold">You: </span>
                        {sc.yourReply}
                      </p>
                      <p className="text-muted-foreground text-xs">{sc.tip}</p>
                    </CardContent>
                  </Card>
                ))}
                <Alert>
                  <AlertTitle>Graceful exit</AlertTitle>
                  <AlertDescription>{branch.exitLine}</AlertDescription>
                </Alert>
              </div>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline">Close</Button>} />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
