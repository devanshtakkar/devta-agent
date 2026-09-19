import { useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { fetchIdeas, fileToDataUrl, type IdeasResponse, type Starter } from "@/lib/api";
import { StarterCarousel } from "@/components/StarterCarousel";
import { Button } from "@/components/ui/button";

interface Turn {
  id: number;
  situation: string;
  imagePreview?: string;
  ideas?: IdeasResponse;
  error?: string;
}

const QUICK = ["Cafe", "Restaurant", "Street", "Party", "Campus"];

export function CoachChat() {
  const [situation, setSituation] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState<Starter | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);
    } catch {
      // ignore — text-only fallback
    }
  }

  async function submit(prefill?: string) {
    const text = (prefill ?? situation).trim();
    if (!text || loading) return;
    setLoading(true);
    const turn: Turn = { id: idRef.current++, situation: text, imagePreview: imageDataUrl };
    setTurns((t) => [...t, turn]);
    setSituation("");
    try {
      const ideas = await fetchIdeas(text, imageDataUrl);
      setTurns((ts) => ts.map((x) => (x.id === turn.id ? { ...x, ideas } : x)));
    } catch (e) {
      setTurns((ts) =>
        ts.map((x) =>
          x.id === turn.id ? { ...x, error: e instanceof Error ? e.message : "AI failed — try again" } : x,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* thread */}
      <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-40">
        {turns.length === 0 && (
          <div className="mt-6">
            <h1 className="text-2xl font-semibold tracking-tight">Where are you right now?</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Describe the scene in one line. Add a photo for extra context. Get 4–5 openers in
              seconds — swipe, branch, act.
            </p>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="flex flex-col gap-2">
            <div className="bg-primary text-primary-foreground self-end rounded-2xl rounded-br-md px-3.5 py-2.5 text-[15px] whitespace-pre-line">
              {t.situation}
            </div>
            {t.imagePreview && (
              <img
                src={t.imagePreview}
                alt="scene context"
                className="self-end rounded-2xl border object-cover"
                style={{ width: 160, height: 120 }}
              />
            )}
            {t.error && <p className="text-destructive text-sm">{t.error}</p>}
            {t.ideas && (
              <div className="flex flex-col gap-2">
                <p className="text-[15px] leading-relaxed whitespace-pre-line">{t.ideas.overview}</p>
                <StarterCarousel
                  situation={t.situation}
                  starters={t.ideas.starters}
                  onUse={(s) => {
                    setUsed(s);
                    void navigator.clipboard?.writeText(s.openerLine).catch(() => {});
                  }}
                />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Thinking of openers…
          </p>
        )}
        {used && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            Copied to clipboard: “{used.openerLine}” — go say it, then come back and branch if you
            need the follow-up.
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setUsed(null)}
            >
              dismiss
            </button>
          </div>
        )}
      </div>

      {/* sticky composer */}
      <div className="border-border bg-background fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex gap-1.5 overflow-x-auto">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(`I'm in a ${q.toLowerCase()}. There's a girl nearby I'd like to talk to politely. Quick context: `)}
              className="border-border shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
            >
              {q}
            </button>
          ))}
        </div>
        {imageDataUrl && (
          <div className="relative mb-2 w-fit">
            <img src={imageDataUrl} alt="context" className="h-16 w-24 rounded-xl border object-cover" />
            <button
              type="button"
              aria-label="Remove image"
              onClick={() => setImageDataUrl(undefined)}
              className="absolute -top-2 -right-2 rounded-full bg-black p-1 text-white"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPickImage(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Add photo for context"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus />
          </Button>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={2}
            enterKeyHint="send"
            placeholder="e.g. Cafe, she's reading alone by the window…"
            className="border-input bg-background max-h-28 min-h-11 flex-1 resize-none rounded-xl border px-3 py-2 text-[16px] outline-none"
          />
          <Button type="button" size="icon-lg" aria-label="Get ideas" disabled={!situation.trim() || loading} onClick={() => void submit()}>
            <Send />
          </Button>
        </div>
        <p className="text-muted-foreground mt-1 text-center text-[11px]">
          No voice button — use your phone keyboard mic. Be respectful, read signals, exit gracefully.
        </p>
      </div>
    </div>
  );
}
