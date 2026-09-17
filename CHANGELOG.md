# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Added a Vehicle Service page: maintenance log with category tags and custom tags (#25)
- Added a Beer log page: quick-log buttons, history, daily/monthly charts, yearly summary (#22)
- Added vehicle management: create, edit, delete, with an MFK-due badge (#27)
- Added a Settings page for profile fields, change password, and default vehicle (#23)

## [1.2.0] - 2026-09-17

### Added

- Added a collapse toggle to Kanban columns, showing just the name and card count in a narrow strip; state is remembered per board in the browser (#12)
- Added proactive access-token refresh, scheduled shortly before expiry and backstopped on tab focus, instead of only refreshing on mount and after a request already got a 401 (#18)
- Added a global error toast so a failed request surfaces to the user instead of failing silently (#18)

### Changed

- Changed the Notes content field and Kanban card description field from a markup-toolbar-on-plain-textarea to a full WYSIWYG rich-text editor, matching urs-android's own editor (#20)
- Changed the app-wide page background and card style to the glass-style look already used on the Kanban screens, rolled out incrementally page by page (#26)
- Changed the Kanban card description field to a rich-text editor with the same markup toolbar as Notes (bold/italic/underline/link/bullet/numbered/indent), fixing it not behaving as a proper multi-line input (#16)
- Changed Kanban columns and board cards (on both the board detail and boards list screens) from a flat bordered card to a glass-style look (subtle tinted fill, thin rim, soft inward-fading glow) against a diagonal background gradient, matching the mockup used for urs-android's own Kanban columns (#17)

### Fixed

- Fixed Kanban columns not filling the available screen height, so horizontal swipe/scroll works anywhere on screen and a long column scrolls internally instead of growing past it (#14)
- Fixed saving a Kanban card giving no feedback; it now closes the dialog and shows a confirmation on success, and shows an error inline on failure instead of failing silently (#15)
- Fixed dragging a Kanban card or column past its own position landing one slot further than intended
- Fixed a dragged Kanban card getting visually clipped at its column's edge and fighting the board's own horizontal scroll, by rendering the dragged card/column in a floating overlay instead of moving it in place
- Fixed a dropped Kanban card visibly flying back to its old column before jumping to the new one, by applying the move to a dedicated local state synchronously on drop instead of writing into the query cache (whose own change notifications are deferred a tick, too late for the drop animation to see)
- Fixed the Notes bullet/numbered list toolbar buttons not toggling off an existing marker, and Enter inside a list not continuing (or exiting, on an empty item) the list on the new line (#19)

## [1.1.0] - 2026-09-16

### Security

- Switched the household-member picker to the new `GET /api/v1/household-users` endpoint; `GET /api/v1/getuser` now only ever returns the caller's own profile (#13)

## [1.0.0] - 2026-09-15

First public release.

## [0.4.0] - 2026-09-15

### Added

- LICENSE (MIT).

### Security

- Reworded code comments describing the `getuser` endpoint's response handling, and trimmed infra-mechanism detail from deploy templates and the admin page comment.

## [0.3.0] - 2026-09-13

### Added
- Kanban feature: boards, freely orderable columns and cards with drag-and-drop within and across columns, card detail (description, due date, priority, tags, checklist, optional linked note) (#11)

## [0.2.0] - 2026-09-12

### Added
- Inventory feature: inventories, product grid with quantity tracking, low-stock thresholds, reminders, sharing (#6)
- Shopping List feature: lists, item grid grouped by category, notes/quantity/on-sale, recently-used quick-add, sharing (#7)
- Life Map feature: read-only GPS history view with time-range filter, gradient track, muted map style (#8)
- Work Time feature: entries with breaks, monthly hours/wage summary, month overrides, wage-rule settings (#9)

### Fixed
- Chores: tracker-event and tracker-type updates failing silently (PUT responses parsed as JSON despite the backend returning 204 No Content)
- Chores: "Log now" creating an event with no time/note instead of opening the entry form

### Changed
- Chores calendar: outline today's date

## [0.1.0] - 2026-09-11

### Added
- Deployment pipeline: GitHub Actions image build, staging environment, admin-triggered rollout (#1)
- Authentication (httpOnly-cookie refresh) and Home feature-tile grid (#2)
- Notes feature (#3)
- Chores feature (#5)
