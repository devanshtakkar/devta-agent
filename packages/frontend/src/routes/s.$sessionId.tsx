import { createFileRoute, Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { queryClient } from "@/lib/query-client";
import { getSession, sessionsKeys } from "@/lib/api";
import { chatErrorMessage } from "@/lib/chat-errors";
import { CoachChat } from "@/components/CoachChat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/s/$sessionId")({
  loader: ({ params }) =>
    queryClient.ensureQueryData({
      queryKey: sessionsKeys.detail(params.sessionId),
      queryFn: () => getSession(params.sessionId),
    }),
  component: SessionView,
  pendingComponent: () => (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 items-center justify-center">
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner /> Loading chat…
      </p>
    </div>
  ),
  errorComponent: SessionError,
});

function SessionView() {
  const { sessionId } = Route.useParams();
  return <CoachChat key={sessionId} sessionId={sessionId} />;
}

function SessionError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>{chatErrorMessage(error, "open")}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => void router.invalidate()}>
          Try again
        </Button>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Start a new chat
        </Link>
      </div>
    </div>
  );
}
