import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STAGE_ACCENT, stageLabel } from "@/lib/connection-meta";
import type { ConnectionStatus } from "@/lib/api";

export function StageBadge({
  stage,
  className,
}: {
  stage: ConnectionStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", STAGE_ACCENT[stage], className)}
    >
      {stageLabel(stage)}
    </Badge>
  );
}
