# urs-web

A web frontend (React/TypeScript SPA) for the URS household-tracking
app, companion to [urs-android](https://github.com/3lefeint/urs-android).
Talks directly to the same private backend API `urs-android` uses.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [TanStack Query](https://tanstack.com/query) for server-state/caching
  against the REST API
- [React Router](https://reactrouter.com/) for client-side routing
- [Tailwind CSS](https://tailwindcss.com/) +
  [shadcn/ui](https://ui.shadcn.com/) for styling/components

## Architecture

Thin client — every read/write goes directly against the backend API,
no local persistent data store.

Authentication uses the same JWT login flow as the Android app, with
the refresh token held in an httpOnly cookie rather than app-side
storage.

## Development

```bash
npm install
npm run dev
```

## Releasing

SemVer, starting at `0.1.0`. `master` is the release branch, `testing`
is for ongoing work (same split as `urs-android`/`urs-zepp`).
