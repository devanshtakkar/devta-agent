import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ImagePlusIcon, SendIcon, SparklesIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import {
  createSession,
  fileToDataUrl,
  getSession,
  postTurn,
  sessionsKeys,
  type ChatSessionDetail,
  type IdeasResponse,
  type PersistedBranch,
  type PersistedTurn,
  type Starter,
} from "@/lib/api";
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

interface UiTurn {
  situation: string;
  /** Ephemeral photo preview — never persisted. */
  imagePreview?: string;
  ideas?: IdeasResponse;
  persistedBranches: PersistedBranch[];
  error?: string;
  pending?: boolean;
  turnIndex: number;
}

const QUICK = ["Cafe", "Restaurant", "Street", "Party", "Campus"];

function toUiTurn(t: PersistedTurn, turnIndex: number): UiTurn {
  return {
    situation: t.situation,
    ideas: { overview: t.overview, starters: t.starters },
    persistedBranches: t.branches ?? [],
    error: t.error,
    turnIndex,
  };
}

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

export function CoachChat({ sessionId }: { sessionId: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [situation, setSituation] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  // The detail route loader warms this cache before first render, so the
  // initializer below hydrates synchronously with no loading flash.
  const [turns, setTurns] = useState<UiTurn[]>(() => {
    if (!sessionId) return [];
    const cached = queryClient.getQueryData<ChatSessionDetail>(
      sessionsKeys.detail(sessionId),
    );
    return cached?.turns.map(toUiTurn) ?? [];
  });
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState<Starter | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const detailQuery = useQuery({
    queryKey: sessionsKeys.detail(sessionId ?? ""),
    queryFn: () => getSession(sessionId ?? ""),
    enabled: sessionId !== null,
    staleTime: 10_000,
  });

  function refreshListSoon(firstTurn: boolean) {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.list });
    // The AI title lands shortly after the first turn — pick it up.
    if (firstTurn) {
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: sessionsKeys.list });
      }, 8000);
    }
  }

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
    // New chat: create the session first, then post the turn, then route to it.
    if (sessionId === null) {
      const pending: UiTurn = { situation: text, imagePreview: imageDataUrl, pending: true, persistedBranches: [], turnIndex: 0 };
      setTurns([pending]);
      setSituation("");
      try {
        const created = await createSession();
        const { turn } = await postTurn(created.uuid, text, imageDataUrl);
        setImageDataUrl(undefined);
        refreshListSoon(true);
        void navigate({ to: "/s/$sessionId", params: { sessionId: created.uuid } });
        // The detail route loader fetches the persisted turn; local echo below
        // is only a fallback in case navigation is slow.
        setTurns([{ ...toUiTurn(turn, 0), imagePreview: undefined }]);
      } catch (e) {
        setTurns([
          { ...pending, pending: false, error: e instanceof Error ? e.message : "AI failed — try again" },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    const uuid = sessionId;
    const turnIndex = turns.length;
    const pending: UiTurn = {
      situation: text,
      imagePreview: imageDataUrl,
      pending: true,
      persistedBranches: [],
      turnIndex,
    };
    setTurns((t) => [...t, pending]);
    setSituation("");
    const firstTurn = turnIndex === 0;
    try {
      const { turn } = await postTurn(uuid, text, imageDataUrl);
      setTurns((ts) =>
        ts.map((x, i) => (i === turnIndex ? toUiTurn(turn, turnIndex) : x)),
      );
      setImageDataUrl(undefined);
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(uuid) });
      refreshListSoon(firstTurn);
    } catch (e) {
      setTurns((ts) =>
        ts.map((x, i) =>
          i === turnIndex
            ? { ...x, pending: false, error: e instanceof Error ? e.message : "AI failed — try again" }
            : x,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleBranched(turnIndex: number, branch: PersistedBranch) {
    setTurns((ts) =>
      ts.map((x, i) =>
        i === turnIndex ? { ...x, persistedBranches: [...x.persistedBranches, branch] } : x,
      ),
    );
    if (sessionId) {
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
    }
  }

  if (sessionId !== null && detailQuery.isPending && turns.length === 0) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 items-center justify-center">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner /> Loading chat…
        </p>
      </div>
    );
  }

  if (sessionId !== null && detailQuery.isError && turns.length === 0) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm">Couldn't load this chat.</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/" })}>
          Start a new chat
        </Button>
      </div>
    );
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
              {turns.map((t, i) => (
                <MessageScrollerItem key={`${sessionId ?? "new"}:${i}`} messageId={`${sessionId ?? "new"}:${i}`} scrollAnchor>
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
                    {t.pending && !t.ideas && !t.error && (
                      <Message align="start">
                        <AiAvatar />
                        <MessageContent>
                          <p className="text-muted-foreground flex items-center gap-2 px-3.5 text-sm">
                            <Spinner /> Thinking of openers…
                          </p>
                        </MessageContent>
                      </Message>
                    )}
                    {t.ideas && (
                      <Message align="start">
                        <AiAvatar />
                        <MessageContent>
                          <Bubble variant="muted" align="start">
                            <BubbleContent>{t.ideas.overview}</BubbleContent>
                          </Bubble>
                          {sessionId ? (
                            <StarterCarousel
                              starters={t.ideas.starters}
                              sessionUuid={sessionId}
                              turnIndex={t.turnIndex}
                              persistedBranches={t.persistedBranches}
                              onBranched={(b) => handleBranched(i, b)}
                              onUse={(s) => {
                                setUsed(s);
                                void navigator.clipboard?.writeText(s.openerLine).catch(() => {});
                              }}
                            />
                          ) : (
                            <p className="text-muted-foreground px-3.5 text-sm">
                              Saving chat…
                            </p>
                          )}
                        </MessageContent>
                      </Message>
                    )}
                  </MessageGroup>
                </MessageScrollerItem>
              ))}
              {loading && sessionId !== null && (
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
