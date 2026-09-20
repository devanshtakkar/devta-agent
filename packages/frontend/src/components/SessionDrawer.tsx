import { useState } from "react";
import {
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  createSession,
  deleteSession,
  listSessions,
  renameSession,
  sessionsKeys,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
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
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: sessionsKeys.list,
    queryFn: listSessions,
    enabled: open,
    staleTime: 30_000,
  });

  const invalidateList = () =>
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (s) => {
      invalidateList();
      onOpenChange(false);
      void navigate({ to: "/s/$sessionId", params: { sessionId: s.uuid } });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ uuid, title }: { uuid: string; title: string }) =>
      renameSession(uuid, title),
    onSuccess: (_data, vars) => {
      setEditingUuid(null);
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      void queryClient.invalidateQueries({
        queryKey: sessionsKeys.detail(vars.uuid),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: (_data, uuid) => {
      setConfirmDelete(null);
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      void queryClient.removeQueries({ queryKey: sessionsKeys.detail(uuid) });
      if (activeUuid === uuid) void navigate({ to: "/" });
    },
  });

  function submitRename(uuid: string) {
    const title = draft.trim();
    if (!title || title.length > 80) return;
    renameMutation.mutate({ uuid, title });
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="left"
    >
      <DrawerContent className="max-w-xs">
        <DrawerHeader className="text-left">
          <DrawerTitle>Chats</DrawerTitle>
          <DrawerDescription>
            Previous wingman sessions, newest first.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <Button
            className="w-full"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <MessageSquarePlusIcon data-icon="inline-start" />
            New chat
          </Button>
          {createMutation.isError && (
            <p className="text-destructive mt-2 text-xs">
              Couldn't create a chat — try again.
            </p>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
          {listQuery.isPending && (
            <div className="flex flex-col gap-2 p-2" aria-label="Loading chats">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}
          {listQuery.isError && (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              Couldn't load chats. Close and retry.
            </p>
          )}
          {listQuery.data?.length === 0 && (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              No chats yet — start a new one.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {listQuery.data?.map((s) => {
              const isActive = s.uuid === activeUuid;
              const isEditing = editingUuid === s.uuid;
              const isConfirming = confirmDelete === s.uuid;
              return (
                <li
                  key={s.uuid}
                  className={`rounded-xl ${isActive ? "bg-accent" : ""}`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1 p-2">
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
                        className="bg-background border-input min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm"
                      />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Save title"
                        disabled={
                          !draft.trim() || renameMutation.isPending
                        }
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
                    <div className="flex items-center gap-1 p-1">
                      <Link
                        to="/s/$sessionId"
                        params={{ sessionId: s.uuid }}
                        onClick={() => onOpenChange(false)}
                        className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquareIcon className="size-4 shrink-0 opacity-60" />
                          <span className="truncate text-sm font-medium">
                            {s.title}
                          </span>
                        </span>
                        <span className="text-muted-foreground mt-0.5 block truncate pl-6 text-xs">
                          {s.turnCount === 0
                            ? "Empty chat"
                            : `${s.turnCount} turn${s.turnCount === 1 ? "" : "s"} · ${timeAgo(s.updatedAt)}`}
                        </span>
                      </Link>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Rename ${s.title}`}
                        onClick={() => {
                          setConfirmDelete(null);
                          setEditingUuid(s.uuid);
                          setDraft(s.title === "New chat" ? "" : s.title);
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      {isConfirming ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(s.uuid)}
                        >
                          Delete?
                        </Button>
                      ) : (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${s.title}`}
                          onClick={() => {
                            setEditingUuid(null);
                            setConfirmDelete(s.uuid);
                            window.setTimeout(() => {
                              setConfirmDelete((cur) =>
                                cur === s.uuid ? null : cur,
                              );
                            }, 4000);
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
