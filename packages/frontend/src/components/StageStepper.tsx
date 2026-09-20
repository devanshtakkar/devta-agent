import { CONNECTION_STAGES, type ConnectionStage, type ConnectionStatus } from "@/lib/api";
import { STAGE_ORDER, isTerminalStage, stageLabel } from "@/lib/connection-meta";
import { cn } from "@/lib/utils";

export function StageStepper({
  stage,
  onSelect,
  disabled,
}: {
  stage: ConnectionStatus;
  onSelect: (stage: ConnectionStage) => void;
  disabled?: boolean;
}) {
  const currentOrder = isTerminalStage(stage)
    ? CONNECTION_STAGES.length
    : STAGE_ORDER[stage];

  return (
    <div className="flex flex-wrap gap-1.5">
      {CONNECTION_STAGES.map((s, i) => {
        const isCurrent = s === stage;
        const reached = i <= currentOrder;
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            aria-current={isCurrent ? "step" : undefined}
            onClick={() => onSelect(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              "outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50",
              isCurrent
                ? "border-primary bg-primary text-primary-foreground"
                : reached
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {stageLabel(s)}
          </button>
        );
      })}
    </div>
  );
}
