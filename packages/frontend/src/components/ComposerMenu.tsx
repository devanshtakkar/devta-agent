import { Menu } from "@base-ui/react/menu";
import { ImagePlusIcon, Plus, SparklesIcon } from "lucide-react";
import { cn } from "cn";

export function ComposerMenu({
  onAddImage,
  onApproaches,
  disabled,
  approachesDisabled,
}: {
  onAddImage: () => void;
  onApproaches: () => void;
  disabled?: boolean;
  approachesDisabled?: boolean;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        aria-label="Add to message"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none",
          "hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Plus className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={8} className="z-50">
          <Menu.Popup
            className={cn(
              "min-w-56 rounded-2xl border border-popover bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "transition-[transform,opacity] duration-150 ease-out",
              "data-starting-style:scale-95 data-starting-style:opacity-0",
              "data-ending-style:scale-95 data-ending-style:opacity-0",
            )}
          >
            <Menu.Item
              disabled={approachesDisabled}
              onClick={onApproaches}
              className={cn(
                "flex cursor-default items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none select-none",
                "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                "data-disabled:pointer-events-none data-disabled:opacity-50",
              )}
            >
              <SparklesIcon className="size-4" />
              <span className="flex flex-col">
                Approach options
                <span className="text-muted-foreground text-xs">
                  Compose 5 openers you can act on
                </span>
              </span>
            </Menu.Item>
            <Menu.Item
              onClick={onAddImage}
              className={cn(
                "flex cursor-default items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none select-none",
                "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                "data-disabled:pointer-events-none data-disabled:opacity-50",
              )}
            >
              <ImagePlusIcon className="size-4" />
              Add image
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
