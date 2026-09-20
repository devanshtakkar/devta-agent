import { useEffect, useMemo, useRef, useState } from "react";
import type { FileUIPart, ReasoningUIPart, TextUIPart } from "ai";
import { useChat } from "@ai-sdk/react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SendIcon,
  SparklesIcon,
  SquareIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import {
  chatTransport,
  createSession,
  fileToDataUrl,
  getSession,
  sessionsKeys,
  type ApproachToolPart,
  type BranchToolPart,
  type ChatMessage,
  type ChatSessionDetail,
  type Starter,
} from "@/lib/api";
import { setPendingDraft, takePendingDraft } from "@/lib/pending-draft";
import { ApproachOptions } from "@/components/ApproachOptions";
import { BranchScenarios } from "@/components/BranchScenarios";
import { ComposerMenu } from "@/components/ComposerMenu";
import { Response } from "@/components/Response";
import { Thinking } from "@/components/Thinking";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Attachment,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent, MessageGroup } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";

const QUICK = ["Cafe", "Restaurant", "Street", "Party", "Campus"];

const APPROACH_PROMPT =
  "Give me 5 concrete approaches for what to do right now, based on our conversation.";

function imagePart(dataUrl: string): FileUIPart {
  return { type: "file", mediaType: "image/jpeg", url: dataUrl, filename: "scene.jpg" };
}

function UserParts({ message }: { message: ChatMessage }) {
  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <Bubble key={i} variant="default" align="end">
              <BubbleContent>{(part as TextUIPart).text}</BubbleContent>
            </Bubble>
          );
        }
        if (part.type === "file" && (part as FileUIPart).mediaType?.startsWith("image/")) {
          return (
            <Attachment key={i} state="done" size="sm" className="self-end">
              <AttachmentMedia variant="image">
                <img src={(part as FileUIPart).url} alt="scene context" />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>Scene photo</AttachmentTitle>
              </AttachmentContent>
            </Attachment>
          );
        }
        return null;
      })}
    </>
  );
}

function AssistantParts({
  message,
  onBranch,
}: {
  message: ChatMessage;
  onBranch: (starter: Starter) => void;
}) {
  const reasoning = message.parts.filter(
    (p) => p.type === "reasoning",
  ) as ReasoningUIPart[];
  const reasoningText = reasoning.map((r) => r.text).join("\n").trim();
  const reasoningStreaming = reasoning.some((r) => r.state === "streaming");

  const tools = message.parts.filter(
    (p) => p.type === "tool-proposeApproaches",
  ) as unknown as ApproachToolPart[];

  const branchTools = message.parts.filter(
    (p) => p.type === "tool-proposeBranches",
  ) as unknown as BranchToolPart[];

  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as TextUIPart).text)
    .join("");

  return (
    <>
      {(reasoningText || reasoningStreaming) && (
        <Thinking text={reasoningText} streaming={reasoningStreaming} />
      )}
      {tools.map((tool) => (
        <ApproachOptions key={tool.toolCallId} part={tool} onBranch={onBranch} />
      ))}
      {branchTools.map((tool) => (
        <BranchScenarios key={tool.toolCallId} part={tool} />
      ))}
      {text.trim() && (
        <div className="w-full min-w-0">
          <Response>{text}</Response>
        </div>
      )}
    </>
  );
}

export function CoachChat({ sessionId }: { sessionId: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [situation, setSituation] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [approachActive, setApproachActive] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const firstMessageRef = useRef(false);

  // Hydrate synchronously from the route loader's warmed cache.
  const [initialMessages] = useState<ChatMessage[]>(() => {
    if (!sessionId) return [];
    const cached = queryClient.getQueryData<ChatSessionDetail>(
      sessionsKeys.detail(sessionId),
    );
    return cached?.messages ?? [];
  });
  firstMessageRef.current = initialMessages.length === 0;

  const transport = useMemo(
    () => (sessionId ? chatTransport(sessionId) : undefined),
    [sessionId],
  );

  const detailQuery = useQuery({
    queryKey: sessionsKeys.detail(sessionId ?? ""),
    queryFn: () => getSession(sessionId ?? ""),
    enabled: sessionId !== null,
    staleTime: 10_000,
  });

  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    id: sessionId ?? "new",
    messages: initialMessages,
    transport,
    onFinish: () => {
      if (sessionId) {
        void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
      }
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.list });
      if (firstMessageRef.current) {
        firstMessageRef.current = false;
        window.setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: sessionsKeys.list });
        }, 8000);
      }
    },
  });

  // Fire the first message of a brand-new chat after it has been routed.
  useEffect(() => {
    if (!sessionId) return;
    const draft = takePendingDraft();
    if (!draft) return;
    const files = draft.imageDataUrl ? [imagePart(draft.imageDataUrl)] : undefined;
    void sendMessage(
      { text: draft.text, files },
      draft.intent ? { body: { intent: draft.intent } } : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const busy = status === "submitted" || status === "streaming";
  const isFirstMessage = messages.length === 0;

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    try {
      setImageDataUrl(await fileToDataUrl(file));
    } catch {
      // ignore — text-only fallback
    }
  }

  async function submit(prefill?: string) {
    if (busy || creating) return;
    const text = (prefill ?? situation).trim();
    const useApproaches = approachActive;
    // The first message needs the user's own context; later runs can request
    // approaches with no input at all.
    const canSend = text.length > 0 || (useApproaches && !isFirstMessage);
    if (!canSend) return;

    const intent = useApproaches ? ({ intent: "approaches" } as const) : undefined;

    if (sessionId === null) {
      setCreating(true);
      try {
        const created = await createSession();
        queryClient.setQueryData<ChatSessionDetail>(sessionsKeys.detail(created.uuid), {
          uuid: created.uuid,
          title: created.title,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          messages: [],
        });
        setPendingDraft({
          text: text || APPROACH_PROMPT,
          imageDataUrl,
          intent: intent?.intent,
        });
        setSituation("");
        setImageDataUrl(undefined);
        setApproachActive(false);
        void navigate({
          to: "/s/$sessionId",
          params: { sessionId: created.uuid },
          replace: true,
        });
      } catch {
        // Leave the composer intact so the user can retry.
      } finally {
        setCreating(false);
      }
      return;
    }

    const files = imageDataUrl ? [imagePart(imageDataUrl)] : undefined;
    const messageText = text || APPROACH_PROMPT;
    setSituation("");
    setImageDataUrl(undefined);
    setApproachActive(false);
    void sendMessage(
      files && files.length > 0 ? { text: messageText, files } : { text: messageText },
      intent ? { body: intent } : undefined,
    );
  }

  function toggleApproaches() {
    if (busy || creating) return;
    setApproachActive((active) => {
      if (!active) textareaRef.current?.focus();
      return !active;
    });
  }

  function branchFromStarter(starter: Starter) {
    if (busy || creating || !sessionId) return;
    void sendMessage(
      {
        text: `I'm about to open with: “${starter.openerLine}”. Brainstorm how this conversation could branch out — give me a couple of scenarios so I'm prepared for however she reacts.`,
      },
      { body: { intent: "branches" } },
    );
  }

  const last = messages[messages.length - 1];
  const showWorking =
    busy && (!last || last.role !== "assistant" || last.parts.length === 0);

  if (sessionId !== null && detailQuery.isPending && messages.length === 0) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 items-center justify-center">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner /> Loading chat…
        </p>
      </div>
    );
  }

  if (sessionId !== null && detailQuery.isError && messages.length === 0) {
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
            <MessageScrollerContent
              className="gap-4 px-4 pt-4 pb-4"
              aria-busy={busy}
            >
              {messages.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SparklesIcon />
                    </EmptyMedia>
                    <EmptyTitle>Your wingman is here</EmptyTitle>
                    <EmptyDescription>
                      Tell me the scene or ask anything about the moment. When you want
                      ready-to-use options, tap + for approach options.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {messages.map((m, i) => (
                <MessageScrollerItem
                  key={m.id}
                  messageId={m.id}
                  scrollAnchor={m.role === "user" || i === 0}
                >
                  <MessageGroup className="gap-3">
                    <Message align={m.role === "user" ? "end" : "start"}>
                      <MessageContent>
                        {m.role === "user" ? (
                          <UserParts message={m} />
                        ) : (
                          <AssistantParts message={m} onBranch={branchFromStarter} />
                        )}
                      </MessageContent>
                    </Message>
                  </MessageGroup>
                </MessageScrollerItem>
              ))}

              {showWorking && (
                <MessageScrollerItem messageId="working">
                  <Message align="start">
                    <MessageContent>
                      <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Spinner /> {messages.length === 0 ? "Composing…" : "Thinking…"}
                      </p>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}

              {status === "error" && (
                <MessageScrollerItem messageId="error">
                  <Alert variant="destructive">
                    <TriangleAlertIcon />
                    <AlertDescription className="flex items-center justify-between gap-3">
                      <span>
                        {error?.message
                          ? "The wingman hit a snag. Try again."
                          : "Something went wrong."}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => regenerate()}
                      >
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>

        {/* composer */}
        <div className="border-border bg-background w-full shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {messages.length === 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK.map((q) => (
                <Button
                  key={q}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 rounded-full"
                  disabled={busy || creating}
                  onClick={() =>
                    submit(
                      `I'm in a ${q.toLowerCase()}. There's a girl nearby I'd like to talk to politely. Quick context: `,
                    )
                  }
                >
                  {q}
                </Button>
              ))}
            </div>
          )}
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
          {approachActive && (
            <div className="border-primary/30 bg-primary/5 text-primary mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <SparklesIcon className="size-4 shrink-0" />
              <span className="flex flex-1 flex-col">
                Approach options active
                <span className="text-muted-foreground text-xs">
                  {isFirstMessage
                    ? "Describe the scene, then send"
                    : "Send with or without a message"}
                </span>
              </span>
              <button
                type="button"
                aria-label="Remove approach options"
                className="hover:bg-primary/10 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors"
                onClick={() => setApproachActive(false)}
              >
                <XIcon className="size-4" />
              </button>
            </div>
          )}
          <InputGroup>
            <InputGroupAddon align="inline-start" className="py-0 pl-2">
              <ComposerMenu
                disabled={busy || creating}
                approachActive={approachActive}
                onApproaches={toggleApproaches}
                onAddImage={() => fileRef.current?.click()}
              />
            </InputGroupAddon>
            <InputGroupTextarea
              ref={textareaRef}
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={1}
              enterKeyHint="send"
              placeholder="Ask your wingman…"
              aria-label="Message your wingman"
              style={{ fieldSizing: "content" }}
              className="max-h-32 min-h-10 overflow-y-auto px-2 py-2 text-[16px]"
            />
            <InputGroupAddon align="inline-end" className="py-0 pr-2">
              {busy ? (
                <InputGroupButton
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Stop"
                  onClick={() => stop()}
                >
                  <SquareIcon />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="button"
                  variant="default"
                  size="icon-sm"
                  aria-label="Send"
                  disabled={(!situation.trim() && !(approachActive && !isFirstMessage)) || creating}
                  onClick={() => void submit()}
                >
                  {creating ? <Spinner /> : <SendIcon />}
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </MessageScrollerProvider>
  );
}
