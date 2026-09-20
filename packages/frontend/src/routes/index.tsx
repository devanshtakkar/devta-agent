import { createFileRoute } from "@tanstack/react-router";
import { CoachChat } from "../components/CoachChat";

export const Route = createFileRoute("/")({
  component: () => <CoachChat sessionId={null} />,
});
