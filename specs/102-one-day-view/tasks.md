# Tasks: Single-day (Один день) view

Feature dir: /home/reshkin/euler/.obsidian/plugins/test-obsidian-plugin/specs/102-one-day-view

Short description
Add a "single-day" view for viewing/editing a single date's full workout. Useful when workouts have many exercises and the week view is cramped.

Execution flow
1. Setup: confirm build & types
2. Tests-first: add minimal integration test for opening single-day view
3. Core: implement view + command/button
4. UI: styles + accessibility
5. Polish: keyboard shortcuts, unit tests, docs

---

Phase: Setup
- [ ] T001 Ensure local build and type check pass
  - Command: `npm run build` and `npx tsc -noEmit -p .`

- [ ] T002 [P] Add feature flag and route placeholder
  - Files:
    - `src/main.ts` (register command `open-single-day-view`)
    - `src/components/WorkoutTrackerApp.tsx` (placeholder UI hook)
  - Description: register an Obsidian command `open-single-day-view` with default hotkey (optional).

---

Phase: Tests (TDD)
- [ ] T003 [P] Integration test: opening single-day view for a date
  - Files: `tests/integration/test_single_day_view.ts` (create)
  - Description: ensure command opens expected DOM container and populates with the workout data.

---

Phase: Core Implementation
- [ ] T004 Create `showSingleDayView(date)` in `InlineWorkoutEditor` (or new file)
  - Files:
    - `src/processors/InlineWorkoutEditor.ts`
    - `src/components/WorkoutTrackerApp.tsx` (call to open view)
  - Description: function renders a fullscreen modal with the day's workout, supports add/edit/reorder of exercises using existing editor widgets and calls `updateWorkout`/`addWorkout` as appropriate.
  - Dependency: T002

- [ ] T005 [P] Add command/button in `WorkoutTrackerApp` and context menu in week view
  - Files:
    - `src/components/WorkoutTrackerApp.tsx`
    - `src/processors/WorkoutMarkdownProcessor.ts` (if needed for context menu)
  - Description: button on day cells and a command palette entry.

---

Phase: UI & Accessibility
- [ ] T006 Create styles for `.single-day-view` modal in `styles.css`
  - Files: `styles.css`
  - Description: make it scrollable, large, and with clear add/edit buttons.

- [ ] T007 Keyboard: next/prev day shortcuts in single-day view
  - Files: `src/processors/InlineWorkoutEditor.ts` (bind keys while view open)

---

Phase: Polish & Docs
- [ ] T008 [P] Add quickstart steps to `specs/102-one-day-view/quickstart.md`
- [ ] T009 [P] Add unit tests for critical helpers (drag/reorder) if missing
- [ ] T010 Update README.md to mention single-day view command/button

---

Parallel groups
- Group A (can run in parallel): T002, T003, T006
- Group B (sequential): T004 → T005 → T007

Notes
- Use existing editor functions to minimize duplicate UI code.
- If there's an existing modal manager, reuse it to keep consistent close/escape behavior.

Generated using the repository plan and code context.
