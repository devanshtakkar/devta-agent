import { useState } from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { Spinner } from "@/components/ui/spinner";

/**
 * Collapsible reasoning transcript. While the model is still thinking it
 * streams live; once done it collapses to a single status line.
 */
export function Thinking({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(false);
  if (!text && !streaming) return null;

  return (
    <div className="text-muted-foreground w-full max-w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "focus-visible:ring-ring/30 flex items-center gap-1.5 rounded-full py-0.5 text-xs font-medium outline-none transition-colors",
          "hover:text-foreground focus-visible:ring-3",
        )}
      >
        {streaming ? (
          <Spinner className="size-3.5" />
        ) : (
          <BrainIcon className="size-3.5" />
        )}
        <span>{streaming ? "Thinking…" : "Thought it through"}</span>
        <ChevronDownIcon
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {(open || streaming) && (
        <div className="mt-1.5 text-xs leading-relaxed wrap-break-word whitespace-pre-wrap">
          {text || "…"}
        </div>
      )}
    </div>
  );
}
