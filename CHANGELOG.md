# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Added a collapse toggle to Kanban columns, showing just the name and card count in a narrow strip; state is remembered per board in the browser (#12)

### Fixed

- Fixed Kanban columns not filling the available screen height, so horizontal swipe/scroll works anywhere on screen and a long column scrolls internally instead of growing past it (#14)
- Fixed saving a Kanban card giving no feedback; it now closes the dialog and shows a confirmation on success, and shows an error inline on failure instead of failing silently (#15)

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
