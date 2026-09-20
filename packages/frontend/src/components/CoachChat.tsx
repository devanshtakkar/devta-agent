import { useRef, useState } from "react";
import { CheckIcon, ImagePlusIcon, SendIcon, SparklesIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { fetchIdeas, fileToDataUrl, type IdeasResponse, type Starter } from "@/lib/api";
import { StarterCarousel } from "@/components/StarterCarousel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Attachment,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageGroup } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";

interface Turn {
  id: number;
  situation: string;
  imagePreview?: string;
  ideas?: IdeasResponse;
  error?: string;
}

const QUICK = ["Cafe", "Restaurant", "Street", "Party", "Campus"];

function AiAvatar() {
  return (
    <MessageAvatar>
      <Avatar size="sm">
        <AvatarImage src="/apple-touch-icon.png" alt="devta" />
        <AvatarFallback>d</AvatarFallback>
      </Avatar>
    </MessageAvatar>
  );
}

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
    <MessageScrollerProvider autoScroll>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-4 px-4 pt-4 pb-4">
              {turns.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SparklesIcon />
                    </EmptyMedia>
                    <EmptyTitle>Where are you right now?</EmptyTitle>
                    <EmptyDescription>
                      Describe the scene in one line. Add a photo for extra context. Get 4–5
                      openers in seconds — swipe, branch, act.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              {turns.map((t) => (
                <MessageScrollerItem key={t.id} messageId={String(t.id)} scrollAnchor>
                  <MessageGroup className="gap-3">
                    <Message align="end">
                      <MessageContent>
                        <Bubble variant="default" align="end">
                          <BubbleContent>{t.situation}</BubbleContent>
                        </Bubble>
                        {t.imagePreview && (
                          <Attachment state="done" size="sm">
                            <AttachmentMedia variant="image">
                              <img src={t.imagePreview} alt="scene context" />
                            </AttachmentMedia>
                            <AttachmentContent>
                              <AttachmentTitle>Scene photo</AttachmentTitle>
                            </AttachmentContent>
                          </Attachment>
                        )}
                      </MessageContent>
                    </Message>
                    {t.error && (
                      <Alert variant="destructive">
                        <TriangleAlertIcon />
                        <AlertDescription>{t.error}</AlertDescription>
                      </Alert>
                    )}
                    {t.ideas && (
                      <Message align="start">
                        <AiAvatar />
                        <MessageContent>
                          <Bubble variant="muted" align="start">
                            <BubbleContent>{t.ideas.overview}</BubbleContent>
                          </Bubble>
                          <StarterCarousel
                            situation={t.situation}
                            starters={t.ideas.starters}
                            onUse={(s) => {
                              setUsed(s);
                              void navigator.clipboard?.writeText(s.openerLine).catch(() => {});
                            }}
                          />
                        </MessageContent>
                      </Message>
                    )}
                  </MessageGroup>
                </MessageScrollerItem>
              ))}
              {loading && (
                <MessageScrollerItem messageId="thinking">
                  <Message align="start">
                    <AiAvatar />
                    <MessageContent>
                      <p className="text-muted-foreground flex items-center gap-2 px-3.5 text-sm">
                        <Spinner /> Thinking of openers…
                      </p>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
              {used && (
                <MessageScrollerItem messageId="copied-note">
                  <Marker>
                    <MarkerIcon>
                      <CheckIcon />
                    </MarkerIcon>
                    <MarkerContent>
                      Copied to clipboard: “{used.openerLine}” — go say it, then come back and
                      branch if you need the follow-up.
                    </MarkerContent>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="ml-auto shrink-0"
                      onClick={() => setUsed(null)}
                    >
                      dismiss
                    </Button>
                  </Marker>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>

        {/* composer */}
        <div className="border-border bg-background w-full shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 flex gap-1.5 overflow-x-auto">
            {QUICK.map((q) => (
              <Button
                key={q}
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 rounded-full"
                onClick={() => submit(`I'm in a ${q.toLowerCase()}. There's a girl nearby I'd like to talk to politely. Quick context: `)}
              >
                {q}
              </Button>
            ))}
          </div>
          {imageDataUrl && (
            <Attachment state="done" size="sm" className="mb-2">
              <AttachmentMedia variant="image">
                <img src={imageDataUrl} alt="context" />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>Scene photo</AttachmentTitle>
                <AttachmentDescription>Attached to your next message</AttachmentDescription>
              </AttachmentContent>
              <AttachmentAction aria-label="Remove image" onClick={() => setImageDataUrl(undefined)}>
                <XIcon />
              </AttachmentAction>
            </Attachment>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPickImage(e.target.files?.[0])}
          />
          <InputGroup>
            <InputGroupTextarea
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
              aria-label="Describe the situation"
              // Inline style wins over the registry's `field-sizing-content`
              // class (same-specificity utilities resolve by stylesheet order,
              // so a class override isn't deterministic). Fixed rows keep the
              // composer compact like before.
              style={{ fieldSizing: "fixed" }}
              className="max-h-28 min-h-11 pl-3 text-[16px]"
            />
            <InputGroupAddon align="block-end">
              <InputGroupButton
                type="button"
                size="icon-sm"
                aria-label="Add photo for context"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlusIcon />
              </InputGroupButton>
              <InputGroupButton
                type="button"
                variant="default"
                size="icon-sm"
                aria-label="Get ideas"
                disabled={!situation.trim() || loading}
                className="ml-auto"
                onClick={() => void submit()}
              >
                <SendIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </MessageScrollerProvider>
  );
}
