# frontend (`packages/frontend`) — Agent Rules

## Package manager

- This is part of the root pnpm monorepo. Run installs from root (`pnpm install`).
- Always use `pnpm` for installs, scripts, and lockfile updates (e.g. `pnpm --filter d-frontend ...`).
- Do NOT use `npm` or `yarn`. `package-lock.json` and `yarn.lock` are gitignored; only the root `pnpm-lock.yaml` is tracked.

## UI components (shadcn-managed)

- ALWAYS check the shadcn component registry before creating a new component. Use the shadcn skill or the shadcn MCP server to search existing components (official and configured registries).
- Creating a custom component is a LAST RESORT — only when no suitable registry component exists. Prefer a registry component, or compose/extend one, over writing from scratch.
- Do NOT create, edit, or delete files in `src/components/ui/` without explicit user confirmation.
- This folder is managed by shadcn. Before any change there, explain what changes are required and why, and ask for permission.
- Create custom components outside `ui/` (e.g. directly under `src/components/`) — those are freely editable.
- To add/update shadcn components, prefer the shadcn CLI (`pnpm dlx shadcn@latest ...`) over hand-editing.

## Routing (TanStack Router, file-based)

- Use TanStack Router with file-based routing. Routes live in `src/routes/`:
  `__root.tsx` (shared layout + `Outlet`), `index.tsx` (`/`), and one file per
  route (e.g. `src/routes/history.tsx` → `/history`, `$id` segments for params).
- NEVER hand-roll routing with `useState` view switches or `window.location`.
  Add a route file, export `Route = createFileRoute('<path>')({ component })`,
  navigate with `Link` / `useNavigate`.
- The Vite plugin (`tanstackRouter` in `vite.config.ts`) generates
  `src/routeTree.gen.ts` — COMMIT it, do not hand-edit. `src/main.tsx` creates
  the router via `createRouter({ routeTree })` and renders `RouterProvider`.
- Loaders beat effects: prefer route `loader`s + `Route.useLoaderData()` over
  `useEffect` fetches. Preload query data in loaders via the shared
  `queryClient` (`src/lib/query-client.ts`) with `ensureQueryData` when possible.

## Data fetching (TanStack Query first)

- Use TanStack Query (`useQuery`, `useMutation`, `useSuspenseQuery`) for ALL
  server state. Do NOT use bare `fetch` in components (only inside typed
  `queryFn` / `mutationFn` helpers like `src/lib/api.ts`).
- Reuse the shared singleton from `src/lib/query-client.ts` — do not create
  new `QueryClient`s. Defaults: `staleTime 30s`, `gcTime 5min`, `retry: 1` for
  queries, `refetchOnWindowFocus: false` (mobile speed-to-action).
- Colocate `queryKey` factories with the API helper (e.g.
  `ideasKeys.detail(situation)`), use `useMutation` + `queryClient.invalidateQueries`
  for writes, and surface `isPending` / `isError` states in the UI.
- Devtools (`ReactQueryDevtools`, `TanStackRouterDevtools`) render in DEV only —
  keep that guard.

## Styles (shadcn-managed CSS)

- NEVER edit `src/index.css` — it is shadcn-managed and will be overwritten by shadcn updates.
- If custom CSS is needed, create a NEW css file (e.g. `src/theme.css`) and import it in `src/main.tsx` AFTER `index.css` so it wins the cascade on equal specificity.
