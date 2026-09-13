# urs-web

A browser companion (React/TypeScript SPA) to
[urs-android](https://github.com/3lefeint/urs-android), part of the
`urs` household-tracking app family — for the handful of tasks that
are more comfortable on a keyboard than a phone screen. Talks directly
to the same private backend API `urs-android` uses; usable only from
the home network or over the same WireGuard tunnel the mobile app
uses.

## Features

Ported one feature at a time from `urs-android`, reusing its data
model and REST API:

- **Notes** — rich-text notes with tags, optional reminders, and a
  live tag-suggestion chip input.
- **Chores and Stuff** — the same generic recurring-activity tracker
  as the mobile app: custom types, a click-through month calendar,
  per-type overdue status.
- **Inventory** — stock by category and product, low-stock
  thresholds, a searchable icon picker.
- **Shopping List** — multiple lists, item grid, recently-used
  product suggestions, sharing.
- **Kanban board** — boards with freely configurable columns and
  drag-and-drop cards (`@dnd-kit`), card detail with checklist, tags,
  due date, priority, and an optional linked note.
- **Life map** — the GPS track history captured by the mobile app,
  browsable on a map.
- **Work time** — entries, breaks, month overrides, and the full wage
  breakdown, mirroring the mobile app's calculations.
- **Admin** — a super-user-only page to trigger a rollout of this
  environment's own deployment straight from the browser.

Not yet ported (tracked in
[`urs-web`#4](https://github.com/3lefeint/urs-web/issues/4)): fuel,
beer log, baking, vehicle/service, and app-level settings.

## Architecture

Thin client — every read/write goes directly against the backend API,
no local persistent data store (there's no offline scenario to design
for: the app is only usable while already on the home network).

Authentication uses the same JWT login flow as the Android app: the
access token lives only in memory (re-fetched on load), while the
refresh token is set by the backend as an `httpOnly` + `Secure` cookie
rather than app-side storage.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [TanStack Query](https://tanstack.com/query) for server-state/caching
  against the REST API
- [React Router](https://reactrouter.com/) for client-side routing
- [Tailwind CSS](https://tailwindcss.com/) +
  [shadcn/ui](https://ui.shadcn.com/) for styling/components
- [`@dnd-kit`](https://dndkit.com/) for the kanban board's drag-and-drop

## Development

```bash
npm install
npm run dev
```

## Deployment

Docker images are built by GitHub Actions and deployed to Kubernetes.
A push to `testing` deploys to staging, a push to `master` or a
version tag deploys to production — see
[urs-android](https://github.com/3lefeint/urs-android) and
[urs-backend](https://github.com/3lefeint/urs-backend) for the rest of
the family; the backend hosts a matching admin-triggered rollout
endpoint used by the in-app Admin page above.

## Releasing

SemVer, starting at `0.1.0`. `master` is the release branch, `testing`
is for ongoing work (same split as `urs-android`/`urs-zepp`).
