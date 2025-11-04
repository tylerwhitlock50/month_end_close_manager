# UI/UX Improvement Initiative

## Overview
We are planning a multi-phase front-end experience initiative that layers on
top of the existing UX sprint. The focus is on discoverability, navigation,
and data visibility without regressing performance or accessibility. This
document outlines the ten additional improvements, proposed phasing, and the
engineering plan required to ship them safely.

## Guiding Principles
- Keep interactions keyboard accessible and performant.
- Reuse established design tokens and Tailwind utility patterns.
- Ship features behind logical toggles/feature flags when large changes touch
  core flows.
- Add instrumentation (where practical) to confirm adoption post-launch.

## Feature Breakdown

### 1. Global Search Spotlight (`⌘/Ctrl + K`)
**User Problem:** Power users must click through multiple menus to locate
tasks, templates, or navigation targets.

**Solution:** Add a command palette that surfaces entities and navigation
shortcuts.

**Front-end Work**
- New component `frontend/src/components/CommandPalette.tsx` with fuzzy search
  (e.g., using `fuse.js`).
- Add keyboard listener + overlay portal in `frontend/src/components/Layout.tsx`.
- Extend API layer (`frontend/src/lib/api.ts`) with composite search query.

**Back-end Work**
- Add search endpoint (`GET /api/search`) that queries tasks, templates,
  accounts, and routes.
- Ensure endpoint scopes results to the current user’s permissions.

**Testing**
- Jest/Vitest tests for the palette filtering logic.
- API tests for search result structure and permission rules.

### 2. Period Context Bar Enhancements
**Current State:** A working-period dropdown already exists in the top bar but only shows the name/list.

**Improvement:** Expand the selector into a richer context bar that surfaces status, close percentage, target dates, and quick links without leaving the page.

**Front-end Work**
- Extend the existing dropdown in `Layout.tsx` with a popover that shows status badge, completion %, target close date, and shortcuts (view period, manage tasks, upload TB).
- Add subtle warning state if no period is selected.

**Back-end Work**
- Reuse `/api/periods/` data; optionally add a lightweight `/api/periods/{id}/summary` endpoint supplying stats (completion %, outstanding tasks).

**Testing**
- Manual regression to ensure selection still syncs with stores.
- Snapshot/RTL tests for warning and status states.

### 3. Task Dependency Map Overlay
**User Problem:** Hard to visualize upstream/downstream tasks from the current
context.

**Solution:** Modal overlay with mini dependency graph.

**Front-end Work**
- Build `TaskDependencyOverlay` using React Flow (already used in workflow).
- Integrate trigger button in task modal and detail page.

**Back-end Work**
- Extend dependency endpoint to return hierarchical view or reuse workflow
  nodes filtered by task.

**Testing**
- Unit tests for data transforms, manual verification of cycle handling.

### 4. Notification Center Enhancements
**Current State:** We already ship a bell icon with dropdown listing recent notifications.

**Improvement:** Layer on richer functionality—type filters, severity icons, snooze/clear options, and contextual banners for critical alerts.

**Front-end Work**
- Enhance `NotificationsBell` with filter pills (All / Tasks / Files / Reviews) and severity iconography.
- Introduce banner component for global incidents (e.g., “5 overdue tasks”) with persistence across pages.
- Add snooze/clear actions per notification.

**Back-end Work**
- Extend notifications API to supply `type`, `severity`, and support batch snooze/dismiss.
- Ensure banner triggers can be derived from dashboard stats (overdue thresholds, failed imports).

**Testing**
- API tests for new fields and snooze endpoint.
- UI tests covering filter toggles, banner dismissal persistence.

### 5. Dashboard “My Focus Today” Card
**User Problem:** Users need a concise summary of due items each morning.

**Solution:** Dashboard card with personalized due/overdue tasks and pending
reviews.

**Front-end Work**
- Add card to `frontend/src/pages/Dashboard.tsx`.
- Provide quick navigation chips for each bucket (due today, overdue, reviews).

**Back-end Work**
- Extend dashboard stats endpoint with pre-filtered “focus” payload or add
  dedicated `/api/dashboard/focus` route.

**Testing**
- API test covering filtering logic.
- UI snapshot to ensure counts render with empty states.

### 6. Spreadsheet-Style Task Grid View
**User Problem:** Bulk task updates are slow despite new quick-edit options.

**Solution:** Add alternate grid view with keyboard navigation (Excel-like).

**Front-end Work**
- New route or tab under Tasks page using a data-grid library (e.g., TanStack
  Table with row/column virtualization).
- Support inline editing, copy/paste, undo for limited fields.

**Back-end Work**
- Reuse bulk update endpoints; ensure PATCH latency is acceptable.
- Possibly add bulk upsert endpoint for batched saves.

**Testing**
- Unit tests for grid edit reducer.
- Manual QA for accessibility (tab order, screen reader labels).

### 7. Trial Balance Account Health Indicators
**User Problem:** Hard to spot accounts missing tasks, validations, or showing
variances.

**Solution:** Add status badges and filter shortcuts directly in the account table.

**Front-end Work**
- Extend `TrialBalance.tsx` table rows with icon badges (missing validation,
  no linked task, variance > threshold).
- Add hover tooltips linking to remediation actions.

**Back-end Work**
- Extend trial balance data payload with computed health flags.
- Optionally store aggregated health metrics for reporting.

**Testing**
- API tests verifying health flags.
- UI test to ensure filters highlight affected accounts.

### 8. Personalized Home Tab
**User Problem:** Different roles want different landing information.

**Solution:** Allow users to configure a mini-dashboard of widgets.

**Front-end Work**
- New `Home` route with drag-and-drop widget layout (use existing drag helpers
  from workflow if possible).
- Widget catalog (bookmarks, workload chart, recent files, custom links).

**Back-end Work**
- Persist widget layout per user (new table or JSON column).
- Provide default layout per role.

**Testing**
- Unit tests for widget state persistence.
- API tests for CRUD of user home config.

### 9. Close Calendar Timeline
**User Problem:** Close milestones/dependencies aren’t visible on a timeline.

**Solution:** Calendar view showing close schedule, dependencies, and critical tasks.

**Front-end Work**
- New calendar component (could leverage `@fullcalendar/react`).
- Sync with period tasks and dependency metadata.

**Back-end Work**
- Endpoint returning tasks with due dates, dependencies, and owner per period.

**Testing**
- API test verifying payload ordering and filtering.
- UI regression for month/week toggles.

### 10. Notification Preferences (Email/Slack Digests)
**User Problem:** Users want control over frequency and channel for reminders.

**Solution:** Preferences panel where users opt into email/Slack digests.

**Front-end Work**
- Extend `frontend/src/pages/Settings.tsx` with notification preferences card.
- Provide toggles for channels and cadence (instant, daily summary, weekly recap).

**Back-end Work**
- New preferences column/table tied to notifications service.
- Update digest jobs to respect preferences.

**Testing**
- API tests for preference CRUD.
- Manual test to ensure digests honor preferences (requires coordination with notification service).

## Execution Phases

| Phase | Theme | Features | Notes |
|-------|-------|----------|-------|
| 1 | Navigation & Awareness | Command palette, period switcher, focus card | Highest impact/low risk, mostly front-end |
| 2 | Task Insight & Action | Dependency overlay, notification center, account health badges | Touches dashboard + notification backend |
| 3 | Power Productivity | Spreadsheet grid, close calendar | Requires design alignment; ship behind feature flags |
| 4 | Personalization & Preferences | Personalized home, notification preferences | Needs new persistence + settings UX |

## Dependencies & Tooling
- **Design:** Lightweight wireframes for spreadsheet grid, personalized home, and calendar.
- **Libraries:** Evaluate command palette (headless), data grid (TanStack or AG Grid), calendar (FullCalendar).
- **Feature Flags:** Consider using existing config or add simple env flag checks to control rollout.
- **Analytics:** Use existing telemetry hooks to measure adoption (e.g., palette invocation count).

## QA & Rollout Strategy
- Write unit/integration tests per component and endpoint.
- Add targeted Cypress smoke tests for new navigation and command palette.
- Stagger releases: enable features for internal users first, gather feedback, then roll out broadly.
- Update documentation (`README`, `WORKFLOW_BUILDER_GUIDE`, etc.) after each phase ships.

## Open Questions
- Do we need role-based limitations on palette results or personalized widgets?
- Should the spreadsheet grid support offline drafts or autosave?
- Which notification channels are available in production (Slack bot, email)?

---
_Last updated: 2025-02-14_
