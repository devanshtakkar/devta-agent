# Shift tracker

Open the calendar icon in the header or **Shift tracker** in Recents.
Add a person using a name/nickname, place, and first actual sighting.
Existing place names are suggested in the form. This tracker is independent of
Connections and does not add data to AI coach prompts.

- **Today** shows non-paused people with records for today's weekday.
- **Week** groups the same records Monday through Sunday.
- **All** includes paused people. Open a name to edit details, pause, or delete.
- **Seen now** records today's local date/time; only one sighting per person per
  date is allowed. To correct it, edit the sighting rather than logging again.
- **Add shift** records either an actual dated sighting or a declared usual
  weekly shift. Both kinds can be edited or deleted individually.

Times are wall-clock times at the place, not converted timestamps. When logging
from another timezone, enter the place's date and time explicitly. Overnight
windows are not supported: the optional end must be later on the same day.
The server derives sighting weekdays from the entered calendar date, independent
of its own timezone. It rejects invalid dates and future sightings with a one-day
server/client timezone allowance. Each person may have up to 500 records.

Weekly summaries count actual sightings separately from declared shifts. A
declared shift takes precedence for time summaries; otherwise observed times
are used. Summaries use the upper median start/end times for that weekday,
omit invalid combined end times, and display the most recent sighting date.
These are historical summaries, not confirmation that someone is currently at
work. Check old records before relying on them; no notifications or automatic
schedule discovery are performed. Respect disinterest and avoid interrupting work.

All API operations require authentication and scope records to their owner.
Deleting a person requires typed `CONFIRM` and removes their shift history.
Optimistic concurrency returns 409 when another write wins; reload and retry.
Writes require a network connection; there is no offline write queue.

## Verification

From the repository root:

```sh
pnpm --filter d-backend test
pnpm --filter d-backend build
pnpm --filter d-frontend build
pnpm --filter d-frontend lint
```

The backend tests include pure calendar/pattern cases and HTTP route tests with
mocked authentication/database persistence (no external services required).
For live browser testing follow `docs/agent-worktrees.md` and `AGENTS.local.md`.
