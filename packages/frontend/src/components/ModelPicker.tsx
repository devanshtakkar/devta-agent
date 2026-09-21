import { Menu } from "@base-ui/react/menu";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronDownIcon,
  CpuIcon,
  SettingsIcon,
} from "lucide-react";
import { cn } from "cn";

/** `~google/gemini-2.5-pro:free` → `gemini-2.5-pro:free` */
export function shortModelName(model: string): string {
  const id = model.replace(/^~/, "");
  return id.split("/").pop() || id;
}

const itemClass = cn(
  "flex cursor-default items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none select-none",
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
);

export function ModelPicker({
  model,
  models,
  onSelect,
  disabled,
}: {
  /** Model that will generate the next reply. */
  model: string | null;
  /** Models configured in settings. */
  models: string[];
  onSelect: (model: string) => void;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const options = model && !models.includes(model) ? [model, ...models] : models;

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        aria-label="Choose the model for this chat"
        title={model ?? "Default model"}
        className={cn(
          "flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none",
          "hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <CpuIcon className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">
          {model ? shortModelName(model) : "Default model"}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={8} className="z-50">
          <Menu.Popup
            className={cn(
              "max-w-[calc(100vw-2rem)] min-w-64 rounded-2xl border border-popover bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "transition-[transform,opacity] duration-150 ease-out",
              "data-starting-style:scale-95 data-starting-style:opacity-0",
              "data-ending-style:scale-95 data-ending-style:opacity-0",
            )}
          >
            <div className="text-muted-foreground px-3 pt-2 pb-1 text-xs">
              Model for this chat
            </div>
            <div className="max-h-64 overflow-y-auto overscroll-contain">
              {options.length === 0 && (
                <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                  No models configured yet.
                </p>
              )}
              {options.map((id) => (
                <Menu.Item
                  key={id}
                  onClick={() => onSelect(id)}
                  className={itemClass}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{shortModelName(id)}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {id}
                    </span>
                  </span>
                  {id === model && <CheckIcon className="size-4 shrink-0" />}
                </Menu.Item>
              ))}
            </div>
            <div className="border-border my-1 border-t" />
            <Menu.Item
              onClick={() => void navigate({ to: "/settings" })}
              className={itemClass}
            >
              <SettingsIcon className="size-4" />
              Manage models
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
