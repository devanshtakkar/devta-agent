import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryClient } from "@/lib/query-client";
import { getSession, sessionsKeys } from "@/lib/api";
import { CoachChat } from "@/components/CoachChat";

export const Route = createFileRoute("/s/$sessionId")({
  loader: async ({ params }) => {
    try {
      await queryClient.ensureQueryData({
        queryKey: sessionsKeys.detail(params.sessionId),
        queryFn: () => getSession(params.sessionId),
      });
    } catch {
      throw redirect({ to: "/" });
    }
  },
  component: SessionView,
});

function SessionView() {
  const { sessionId } = Route.useParams();
  return <CoachChat key={sessionId} sessionId={sessionId} />;
}
