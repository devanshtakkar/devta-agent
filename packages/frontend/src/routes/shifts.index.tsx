import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import {
  DAYS,
  basis,
  windowLabel,
  listRegulars,
  regularKeys,
  localDate,
  weekday,
  useToday,
  type Regular,
  type Pattern,
} from "@/lib/shifts";
import { FormSheet, RegularForm, SeenNow } from "@/components/ShiftForms";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

export const Route = createFileRoute("/shifts/")({
  loader: () =>
    queryClient
      .ensureQueryData({
        queryKey: regularKeys.list(localDate()),
        queryFn: listRegulars,
      })
      .catch(() => null),
  component: ShiftsView,
});
function Entry({ regular, pattern }: { regular: Regular; pattern?: Pattern }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>
          {regular.venue} · {regular.venueType}
        </CardDescription>
        <CardTitle>
          <Link
            to="/shifts/$regularId"
            params={{ regularId: regular.uuid }}
            className="underline-offset-4 hover:underline"
          >
            {regular.name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {pattern && (
          <div>
            <p>{windowLabel(pattern)}</p>
            <p className="text-muted-foreground text-xs">
              {basis(pattern)}
              {pattern.lastSeen ? ` · last seen ${pattern.lastSeen}` : ""}
            </p>
          </div>
        )}
        {regular.status !== "watching" && (
          <Badge variant="secondary">{regular.status}</Badge>
        )}
        <SeenNow regular={regular} />
      </CardContent>
    </Card>
  );
}
function ShiftsView() {
  const initial = Route.useLoaderData();
  const today = useToday();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: regularKeys.list(today),
    queryFn: listRegulars,
    initialData: initial ?? undefined,
    staleTime: 0,
  });
  const regulars = query.data ?? [];
  const active = regulars.filter((r) => r.status !== "paused");
  const forDay = (day: number) =>
    active
      .flatMap((regular) => {
        const pattern = regular.days.find((d) => d.dayOfWeek === day);
        return pattern ? [{ regular, pattern }] : [];
      })
      .sort(
        (a, b) =>
          Number(b.pattern.declared) - Number(a.pattern.declared) ||
          b.pattern.count - a.pattern.count ||
          a.pattern.startTime.localeCompare(b.pattern.startTime),
      );
  const venues = [
    ...new Map(regulars.map((r) => [r.venue.toLowerCase(), r.venue])).values(),
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold">Shift tracker</h1>
        <FormSheet
          title="Add person"
          description="Log an actual sighting at a public place."
          trigger="+ Add"
        >
          {(close) => (
            <RegularForm
              venues={venues}
              onDone={(r) => {
                close();
                void navigate({
                  to: "/shifts/$regularId",
                  params: { regularId: r.uuid },
                });
              }}
            />
          )}
        </FormSheet>
      </div>
      <p className="text-muted-foreground text-xs">
        Past sightings aren’t confirmed schedules. Keep conversations brief
        while someone is working, and respect disinterest.
      </p>
      {query.isPending && <p>Loading tracker…</p>}
      {query.isError && (
        <div>
          <p>Couldn’t load the tracker.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      )}
      <Tabs defaultValue="today">
        <TabsList className="w-full">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {DAYS[weekday(today)]} · {today}
          </p>
          {forDay(weekday(today)).map(({ regular, pattern }) => (
            <Entry key={regular.uuid} regular={regular} pattern={pattern} />
          ))}
          {!query.isPending &&
            !query.isError &&
            forDay(weekday(today)).length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No entries for today</EmptyTitle>
                  <EmptyDescription>
                    Add a sighting or usual shift, or check the week.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
        </TabsContent>
        <TabsContent value="week" className="flex flex-col gap-4">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="font-semibold">
                {DAYS[day]}
                {day === weekday(today) ? " · today" : ""}
              </h2>
              {forDay(day).map(({ regular, pattern }) => (
                <Entry key={regular.uuid} regular={regular} pattern={pattern} />
              ))}
              {forDay(day).length === 0 && (
                <p className="text-muted-foreground text-sm">No entries</p>
              )}
            </section>
          ))}
        </TabsContent>
        <TabsContent value="all" className="flex flex-col gap-3">
          {regulars.map((regular) => (
            <Entry key={regular.uuid} regular={regular} />
          ))}
          {!regulars.length && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No people yet</EmptyTitle>
                <EmptyDescription>
                  Tap Add to log your first sighting.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
