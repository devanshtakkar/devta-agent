import { useState, type CSSProperties } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  EllipsisVerticalIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  activeConnectionFromError,
  createSession,
  deleteSession,
  listSessions,
  renameSession,
  sessionsKeys,
  STAGE_LABELS,
  type ActiveConnectionInfo,
  type SessionListItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SessionDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeUuid = pathname.startsWith("/s/") ? pathname.slice(3) : null;
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [menuUuid, setMenuUuid] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<
    { uuid: string; title: string; connection: ActiveConnectionInfo } | null
  >(null);
  const [confirmText, setConfirmText] = useState("");

  const listQuery = useQuery({
    queryKey: sessionsKeys.list,
    queryFn: listSessions,
    enabled: open,
    staleTime: 30_000,
  });

  function close() {
    setMenuUuid(null);
    setEditingUuid(null);
    setConfirmDelete(null);
    setBlockedDelete(null);
    setConfirmText("");
    onOpenChange(false);
  }

  const invalidateList = () =>
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (s) => {
      invalidateList();
      close();
      void navigate({ to: "/s/$sessionId", params: { sessionId: s.uuid } });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ uuid, title }: { uuid: string; title: string }) =>
      renameSession(uuid, title),
    onSuccess: (_data, vars) => {
      setEditingUuid(null);
      invalidateList();
      void queryClient.invalidateQueries({
        queryKey: sessionsKeys.detail(vars.uuid),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ uuid, confirm }: { uuid: string; confirm?: string }) =>
      deleteSession(uuid, confirm ? { confirm } : undefined),
    onSuccess: (_data, vars) => {
      setConfirmDelete(null);
      setMenuUuid(null);
      setBlockedDelete(null);
      setConfirmText("");
      invalidateList();
      void queryClient.removeQueries({ queryKey: sessionsKeys.detail(vars.uuid) });
      if (activeUuid === vars.uuid) void navigate({ to: "/" });
    },
    onError: (err, vars) => {
      // The chat is linked to a connection: the API blocks the delete and asks
      // for a typed confirmation. Surface the warning + CONFIRM gate.
      const connection = activeConnectionFromError(err);
      if (!connection) return;
      const item = listQuery.data?.find((s) => s.uuid === vars.uuid);
      setConfirmDelete(null);
      setConfirmText("");
      setBlockedDelete({
        uuid: vars.uuid,
        title: item?.title ?? "This chat",
        connection,
      });
    },
  });

  function startRename(s: SessionListItem) {
    setMenuUuid(null);
    setConfirmDelete(null);
    setEditingUuid(s.uuid);
    setDraft(s.title === "New chat" ? "" : s.title);
  }

  function submitRename(uuid: string) {
    const title = draft.trim();
    if (!title || title.length > 80) return;
    renameMutation.mutate({ uuid, title });
  }

  return (
    <Drawer open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} swipeDirection="left">
      <DrawerContent
        // Full-bleed panel: override the registry default inset, width and
        // rounding (inline style so it beats the stylesheet-declared vars).
        style={
          {
            "--drawer-inset": "0px",
            "--drawer-content-width": "100%",
            "--drawer-content-height": "100dvh",
            borderRadius: 0,
            borderWidth: 0,
          } as CSSProperties
        }
        className="w-full max-w-none p-0"
      >
        <div className="flex h-full min-h-0 flex-col bg-popover">
          <header className="flex items-center justify-between gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3">
            <DrawerTitle className="font-heading text-2xl font-semibold tracking-tight">
              Recents
            </DrawerTitle>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Close recents"
              onClick={close}
            >
              <XIcon />
            </Button>
          </header>
          <DrawerDescription className="sr-only">
            Your previous coaching chats, newest first.
          </DrawerDescription>

          <div className="px-5 pb-3">
            <Button
              className="h-11 w-full text-[15px]"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              <MessageSquarePlusIcon data-icon="inline-start" />
              New chat
            </Button>
            {createMutation.isError && (
              <p className="text-destructive mt-2 text-xs">
                Couldn&apos;t create a chat — try again.
              </p>
            )}
          </div>

          <div className="border-border/60 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t">
            {listQuery.isPending && (
              <div className="flex flex-col gap-1 p-4" aria-label="Loading recents">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}
            {listQuery.isError && (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                Couldn&apos;t load recents. Close and retry.
              </p>
            )}
            {listQuery.data?.length === 0 && (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                No chats yet — start a new one.
              </p>
            )}

            <ul>
              {listQuery.data?.map((s) => {
                const isActive = s.uuid === activeUuid;
                const isEditing = editingUuid === s.uuid;
                const isMenuOpen = menuUuid === s.uuid;
                const isConfirming = confirmDelete === s.uuid;
                return (
                  <li
                    key={s.uuid}
                    className={`border-border/50 border-b border-l-[3px] transition-colors ${
                      isActive
                        ? "border-l-primary bg-primary/10"
                        : isMenuOpen
                          ? "border-l-transparent bg-muted/50"
                          : "border-l-transparent"
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 px-4 py-3">
                        <input
                          // eslint-disable-next-line jsx-a11y/no-autofocus -- explicit user action
                          autoFocus
                          value={draft}
                          maxLength={80}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitRename(s.uuid);
                            if (e.key === "Escape") setEditingUuid(null);
                          }}
                          aria-label="Chat title"
                          className="bg-background border-input min-w-0 flex-1 rounded-md border px-2.5 py-2 text-sm"
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Save title"
                          disabled={!draft.trim() || renameMutation.isPending}
                          onClick={() => submitRename(s.uuid)}
                        >
                          <CheckIcon />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Cancel rename"
                          onClick={() => setEditingUuid(null)}
                        >
                          <XIcon />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-stretch">
                          <Link
                            to="/s/$sessionId"
                            params={{ sessionId: s.uuid }}
                            onClick={close}
                            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
                          >
                            <MessageSquareIcon className="text-muted-foreground size-5 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-medium">
                                {s.title}
                              </span>
                              <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                                {s.messageCount === 0
                                  ? "No messages yet"
                                  : s.preview || `${s.messageCount} messages`}
                                {" · "}
                                {timeAgo(s.updatedAt)}
                              </span>
                            </span>
                          </Link>
                          <div className="flex items-center pr-2">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Actions for ${s.title}`}
                              aria-expanded={isMenuOpen}
                              onClick={() => {
                                setConfirmDelete(null);
                                setMenuUuid(isMenuOpen ? null : s.uuid);
                              }}
                            >
                              <EllipsisVerticalIcon />
                            </Button>
                          </div>
                        </div>

                        {isMenuOpen && (
                          <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startRename(s)}
                            >
                              Rename
                            </Button>
                            {isConfirming ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={deleteMutation.isPending}
                                  onClick={() => deleteMutation.mutate({ uuid: s.uuid })}
                                >
                                  Delete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setConfirmDelete(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setConfirmDelete(s.uuid)}
                              >
                                <Trash2Icon data-icon="inline-start" />
                                Delete
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <AlertDialog
          open={blockedDelete !== null}
          onOpenChange={(o) => {
            if (!o) {
              setBlockedDelete(null);
              setConfirmText("");
            }
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>This chat is linked to a connection</AlertDialogTitle>
              <AlertDialogDescription>
                “{blockedDelete?.title}” is the origin of the{" "}
                <span className="text-foreground font-medium">
                  {blockedDelete?.connection.name}
                </span>{" "}
                connection
                {blockedDelete
                  ? ` (${STAGE_LABELS[blockedDelete.connection.stage]})`
                  : ""}
                . Deleting the chat erases its coaching history but keeps the
                connection tracked. Type <span className="font-medium">CONFIRM</span> to
                delete anyway.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CONFIRM"
              aria-label="Type CONFIRM to delete this chat"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={confirmText !== "CONFIRM" || deleteMutation.isPending}
                onClick={() => {
                  if (blockedDelete) {
                    deleteMutation.mutate({ uuid: blockedDelete.uuid, confirm: "CONFIRM" });
                  }
                }}
              >
                Delete chat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}
