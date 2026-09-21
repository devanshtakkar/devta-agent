import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  MessagesSquareIcon,
  Trash2Icon,
} from "lucide-react";
import {
  removeSavedApproach,
  useSavedApproaches,
  type SavedApproach,
} from "@/lib/saved-approaches";
import { RISK_LABELS } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const Route = createFileRoute("/saved")({
  component: SavedView,
});

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "saved just now";
  if (min < 60) return `saved ${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `saved ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `saved ${d}d ago`;
  return `saved ${new Date(iso).toLocaleDateString()}`;
}

function SavedApproachCard({ item }: { item: SavedApproach }) {
  const [open, setOpen] = useState(false);
  const { starter } = item;

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Badge variant="secondary">
            {RISK_LABELS[starter.risk] ?? starter.risk}
          </Badge>
          <span className="truncate">{timeAgo(item.savedAt)}</span>
        </CardDescription>
        <CardTitle>{starter.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="border-border/60 bg-muted/50 rounded-xl border px-3.5 py-2.5">
          <p className="text-[15px] leading-snug font-medium">
            “{starter.openerLine}”
          </p>
        </div>
        {item.overview && (
          <p className="text-muted-foreground text-[13px] leading-snug">
            {item.overview}
          </p>
        )}
        <p className="text-muted-foreground text-[13px] leading-snug">{starter.why}</p>
        <p className="text-[13px] leading-snug">
          <span className="font-semibold">Next: </span>
          {starter.nextMove}
        </p>
        <p className="text-muted-foreground text-[13px] leading-snug">
          <span className="font-semibold">Ease out: </span>
          {starter.gracefulExit}
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        {item.sessionId && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            nativeButton={false}
            render={
              <Link to="/s/$sessionId" params={{ sessionId: item.sessionId }} />
            }
          >
            <MessagesSquareIcon data-icon="inline-start" />
            Open chat
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove saved approach: ${starter.title}`}
          onClick={() => setOpen(true)}
        >
          <Trash2Icon data-icon="inline-start" />
          Remove
        </Button>
      </CardFooter>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this saved approach?</AlertDialogTitle>
            <AlertDialogDescription>
              “{starter.title}” will be removed from this device. This can&apos;t
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => removeSavedApproach(item.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SavedView() {
  const navigate = useNavigate();
  const saved = useSavedApproaches();

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto px-4 py-4">
      <Button
        size="sm"
        variant="ghost"
        className="-ml-2 mb-2 self-start"
        onClick={() => void navigate({ to: "/" })}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back
      </Button>
      <h1 className="font-heading mb-1 text-2xl font-semibold tracking-tight">
        Saved approaches
      </h1>
      <p className="text-muted-foreground mb-4 text-sm">
        Bookmarked openers kept on this device — ready even offline.
      </p>

      {saved.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkIcon />
            </EmptyMedia>
            <EmptyTitle>No saved approaches yet</EmptyTitle>
            <EmptyDescription>
              In a chat, tap the bookmark on any approach option to keep it here.
              Saved options work even without a connection.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="mt-2 flex flex-col gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {saved.map((item) => (
            <SavedApproachCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
