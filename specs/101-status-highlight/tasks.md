# Tasks: Подсветка статуса упражнения при редактуре

**Feature dir**: /home/reshkin/euler/.obsidian/plugins/test-obsidian-plugin/specs/101-status-highlight
**Prerequisites**: repo builds (`npm run build`), TypeScript strict checks

## Short summary
Добавить визуальную подсветку и управление статусом каждого упражнения в форме редактирования тренировки. Статусы: `planned` (запланировано), `done` (выполнено), `skipped` (пропущено), `illness` (болезнь). Статус должен сохраняться в данных тренировки и корректно отображаться в read-only виде.

## Execution Flow (main)
1. Setup: confirm dev environment and types
2. Tests (TDD): add small failing tests for model & renderer
3. Core: add `exercise.status` type and persistence
4. UI: editor badge + toggle UI + keyboard shortcuts
5. Read-only sync: render status in `WorkoutMarkdownProcessor`
6. Polish: styles, accessibility, tests, docs

---

## Phase: Setup
- [ ] T001 Ensure build and type-check pass on `main` (repo root)
  - Files: none (run commands)
  - Command notes: `npm run build` and `npm run lint` (if configured)
  - Dependency: none

- [ ] T002 [P] Add `exercise.status` optional field to types
  - Files:
    - `src/types/index.ts`
  - Description: Update `Exercise`/`ExerciseSpec` definitions to include `status?: 'planned'|'done'|'skipped'|'illness'` and export the type for reuse. Mark [P] (editing types is independent).

---

## Phase: Tests First (TDD) — write tests that fail before implementation
- [ ] T003 [P] Unit test: serializing/deserializing exercise with optional status
  - Files:
    - `tests/unit/test_exercise_status.ts` (create)
  - Description: Test that exercise JSON with and without `status` parses into expected TypeScript shape and that saving preserves the status field.

- [ ] T004 [P] Renderer test: read-only processor renders badge for exercise status
  - Files:
    - `tests/integration/test_workout_markdown_status_render.ts` (create)
  - Description: Mount a minimal DOM, call `WorkoutMarkdownProcessor.renderWorkoutCard(...)` with an exercise having `status: 'done'`, and assert the DOM contains an element with class `exercise-status-badge` and class `status-done`.

Note: mark test files as [P] — they can run in parallel.

---

## Phase: Core Implementation
- [ ] T005 Add status field persistence for exercise objects
  - Files:
    - `src/data/data-manager.ts`
    - `src/processors/InlineWorkoutEditor.ts`
  - Description: Ensure save/load functions for workouts include exercise.status when saving. When creating new exercises in the editor, initialize `status` to `planned` by default.
  - Dependencies: T002, T003

- [ ] T006 [P] Add API in types/helpers to map status → CSS class & readable label
  - Files:
    - `src/utils/data-utils.ts` (or create `src/utils/status-utils.ts` if not present)
  - Description: Provide a small helper: `statusToClass(status?:string): string` and `statusToLabel(status?:string): string` for consistent rendering.

---

## Phase: UI — Editor changes (core user visible work)
- [ ] T007 Inline editor: show status badge for each exercise and allow cycling/status menu
  - Files:
    - `src/processors/InlineWorkoutEditor.ts`
    - `styles.css`
  - Description: Next to each `.exercise-item` in the edit form render a clickable badge (`span.exercise-status-badge`) that reflects the current status (class `status-planned|status-done|status-skipped|status-illness`).
    - Clicking the badge opens a small popup/menu with the four statuses (or cycles on click).
    - Also support right-click context menu and keyboard shortcut `S` when exercise focused to toggle to next status.
  - Dependency: T005, T006

- [ ] T008 [P] Editor UX: add accessible labels and tooltips
  - Files:
    - `src/processors/InlineWorkoutEditor.ts`
    - `styles.css`
  - Description: Add `aria-label` and `title` attributes to badges; ensure contrast meets theme variables.

---

## Phase: Read-only / Sync
- [ ] T009 Update read-only renderer to display status badge inline with exercise card
  - Files:
    - `src/processors/WorkoutMarkdownProcessor.ts`
    - `styles.css`
  - Description: Use same `exercise-status-badge` element with status-specific class so read-only view and editor look consistent.
  - Dependency: T005, T006

---

## Phase: Polish & Tests
- [ ] T010 [P] Add unit tests for status utils
  - Files:
    - `tests/unit/test_status_utils.ts`
  - Description: Validate `statusToClass` and `statusToLabel` behavior.

- [ ] T011 Accessibility and contrast check
  - Files:
    - `styles.css`
  - Description: Verify badge colors readable in dark/light themes; prefer `var()` tokens. Create fallback colors for custom `labelBackground` if used.

- [ ] T012 Manual test scenario (quickstart style)
  - Files:
    - `specs/101-status-highlight/quickstart.md` (create)
  - Description: Document steps to verify feature in Obsidian (open editor, toggle status, save, reload file, verify read-only status).

---

## Deliverables (what to commit)
- `src/types/index.ts` (type updates)
- `src/processors/InlineWorkoutEditor.ts` (editor UI + handlers)
- `src/processors/WorkoutMarkdownProcessor.ts` (read-only rendering)
- `src/data/data-manager.ts` (persistence)
- `src/utils/status-utils.ts` (helpers)
- `styles.css` (styles for badges)
- `tests/` (new unit/integration tests)
- `specs/101-status-highlight/tasks.md` (this file)
- `specs/101-status-highlight/plan.md` (already added)
- `specs/101-status-highlight/quickstart.md` (optional)

## Dependencies & Ordering
- Setup (T001,T002) → Tests (T003,T004) → Core (T005,T006) → UI (T007,T008) → Read-only (T009) → Polish/tests (T010-T012)

## Parallel groups [P]
- Group A (can run together): T002, T003, T004, T006, T010
- Group B: UI tasks touching the same file should be sequential: T005 → T007 → T009

## Commands for task agents (examples)
- Run build and types: `npm run build`
- Run unit tests (jest/mocha placeholder): `npm test` (project currently has no test runner configured — add one if required)
- Apply changes in editor and run `npm run build` to produce `main.js`

---

## Notes / Assumptions
- Repo currently uses TypeScript + esbuild; no test runner configured. The tasks include creating test files — if you prefer not to add a test framework now, mark T003/T004/T010 as optional and run manual verification instead.
- Feature branch naming: create branch `101-status-highlight` (script expects feature branches like `101-...`).
- If `exercise.status` conflicts with existing design, adapt to store at workout level and derive per-exercise status.


---

Generated by the tasks prompt emulation.
