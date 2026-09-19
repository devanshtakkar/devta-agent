import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  const Icon = choice === "light" ? Sun : choice === "dark" ? Moon : Laptop;
  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={`Theme: ${choice}. Switch to ${next}.`}
      title={`Theme: ${choice} (tap for ${next})`}
      onClick={() => setChoice(next)}
    >
      <Icon />
    </Button>
  );
}
