# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
