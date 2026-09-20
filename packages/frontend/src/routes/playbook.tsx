import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { connectionsKeys, getPlaybook } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/playbook")({
  loader: async () => {
    await queryClient.ensureQueryData({
      queryKey: connectionsKeys.playbook,
      queryFn: getPlaybook,
    });
  },
  component: PlaybookPage,
});

function PlaybookPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: connectionsKeys.playbook,
    queryFn: getPlaybook,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Back"
          nativeButton={false}
          render={<Link to="/connections" />}
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Playbook</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-8">
        {isPending && (
          <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
            <Spinner /> Loading…
          </p>
        )}
        {isError && (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Couldn&apos;t load the playbook.
          </p>
        )}

        {data && (
          <>
            <Card size="sm" className="border-primary/30">
              <CardHeader className="grid-cols-[auto_1fr] items-center gap-2">
                <ShieldCheckIcon className="text-primary size-5" />
                <CardTitle className="text-[15px]">How we play</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-snug">
                  {data.principles.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <h2 className="text-muted-foreground mt-5 mb-2 text-xs font-semibold tracking-wide uppercase">
              Stage ladder
            </h2>
            <div className="flex flex-col gap-2.5">
              {data.stages.map((s, i) => (
                <Card key={s.stage} size="sm">
                  <CardHeader className="grid-cols-[auto_1fr] items-center gap-2">
                    <Badge variant="secondary">{i + 1}</Badge>
                    <CardTitle className="text-[15px]">{s.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-sm leading-snug">{s.intent}</p>
                    <p className="text-sm leading-snug">
                      <span className="font-medium">Next move: </span>
                      {s.nextMove}
                    </p>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs font-medium">
                        Milestones
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.milestones.map((m) => (
                          <Badge key={m.key} variant="outline">
                            {m.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {s.traps.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <TriangleAlertIcon className="text-amber-500 mt-0.5 size-3.5 shrink-0" />
                        <p className="text-muted-foreground text-xs leading-snug">
                          {s.traps.join(" · ")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
