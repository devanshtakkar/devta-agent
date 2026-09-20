import { useEffect, useState } from "react";

const VISIBLE_MS = 1100;
const FADE_MS = 500;

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), VISIBLE_MS);
    const done = window.setTimeout(onDone, VISIBLE_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-label="Loading devta"
      className={`bg-background fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src="/apple-touch-icon.png"
        alt="devta logo"
        width={112}
        height={112}
        className="splash-logo size-28 rounded-[28px] shadow-2xl"
      />
      <p className="font-logo text-foreground text-5xl leading-none">devta</p>
      <p className="text-muted-foreground text-sm">your in-the-moment wingman</p>
    </div>
  );
}
