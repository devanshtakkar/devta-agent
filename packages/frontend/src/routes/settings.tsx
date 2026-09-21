import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { queryClient } from "@/lib/query-client";
import {
  getModelSettings,
  modelsKeys,
  saveModelSettings,
  type ModelSettings,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/settings")({
  loader: () =>
    queryClient
      .ensureQueryData({
        queryKey: modelsKeys.settings,
        queryFn: getModelSettings,
      })
      .catch(() => null),
  component: SettingsView,
});

/** Mirrors the API check: `vendor/model`, optional `~` prefix, no whitespace. */
function isValidModelId(value: string): boolean {
  const id = value.trim();
  return (
    id.length > 0 &&
    id.length <= 160 &&
    !/\s/.test(id) &&
    /^~?[^\s/]+\/[^\s]+$/.test(id)
  );
}

function SettingsView() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | undefined>();

  const settingsQuery = useQuery({
    queryKey: modelsKeys.settings,
    queryFn: getModelSettings,
    initialData: initial ?? undefined,
  });
  const settings = settingsQuery.data;

  const saveMutation = useMutation({
    mutationFn: saveModelSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(modelsKeys.settings, data);
      void queryClient.invalidateQueries({ queryKey: modelsKeys.current });
    },
  });

  function persist(next: ModelSettings) {
    saveMutation.mutate(next);
  }

  function addModel() {
    if (!settings) return;
    const id = draft.trim();
    if (!isValidModelId(id)) {
      setFormError("Use an OpenRouter model id like vendor/model.");
      return;
    }
    if (settings.models.includes(id)) {
      setFormError("That model is already in the list.");
      return;
    }
    setFormError(undefined);
    setDraft("");
    persist({
      models: [...settings.models, id],
      defaultModel: settings.defaultModel,
    });
  }

  function makeDefault(id: string) {
    if (!settings || settings.defaultModel === id) return;
    persist({ models: settings.models, defaultModel: id });
  }

  function removeModel(id: string) {
    if (!settings || settings.models.length <= 1) return;
    const models = settings.models.filter((m) => m !== id);
    persist({
      models,
      defaultModel: settings.defaultModel === id ? models[0] : settings.defaultModel,
    });
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto px-4 py-4">
      <header className="mb-4 flex items-center gap-2">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Go back"
          onClick={() => router.history.back()}
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Settings
        </h1>
      </header>

      {!settings && settingsQuery.isPending && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner /> Loading settings…
        </p>
      )}

      {!settings && settingsQuery.isError && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm">Couldn&apos;t load model settings.</p>
          <Button
            variant="outline"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: modelsKeys.settings })
            }
          >
            Retry
          </Button>
        </div>
      )}

      {settings && (
        <div className="flex flex-col gap-4 pb-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Add a model</CardTitle>
              <CardDescription>
                Paste a model id from openrouter.ai/models.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addModel();
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setFormError(undefined);
                  }}
                  placeholder="anthropic/claude-sonnet-4.5"
                  aria-label="OpenRouter model id"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Button
                  type="submit"
                  disabled={!draft.trim() || saveMutation.isPending}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add
                </Button>
              </form>
              {formError && (
                <p className="text-destructive mt-2 text-xs">{formError}</p>
              )}
              {saveMutation.isError && (
                <p className="text-destructive mt-2 text-xs">
                  Couldn&apos;t save — check the model id and try again.
                </p>
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Models in the picker</CardTitle>
              <CardDescription>
                The default starts every new chat. You can switch models any
                time from the chat input.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {settings.models.map((id) => {
                const isDefault = id === settings.defaultModel;
                return (
                  <div
                    key={id}
                    className="border-border flex items-center gap-2 rounded-2xl border px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {id}
                    </span>
                    {isDefault ? (
                      <Badge className="shrink-0 gap-1">
                        <CheckIcon />
                        Default
                      </Badge>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        className="shrink-0"
                        disabled={saveMutation.isPending}
                        onClick={() => makeDefault(id)}
                      >
                        Make default
                      </Button>
                    )}
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                      aria-label={`Remove ${id}`}
                      title={
                        settings.models.length <= 1
                          ? "Keep at least one model"
                          : "Remove"
                      }
                      disabled={
                        settings.models.length <= 1 || saveMutation.isPending
                      }
                      onClick={() => removeModel(id)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
