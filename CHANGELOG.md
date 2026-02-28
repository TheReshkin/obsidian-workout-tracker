# Changelog

All notable changes to the **Obsidian Workout Tracker** plugin.

## [Unreleased] — Codebase refactoring

### Refactored
- Replaced `require()` calls with static ES imports across all processors.
- Extracted shared DOM helpers (`createFullscreenModal`, `hideModal`, `applyLuminanceColor`) into `src/utils/dom-helpers.ts`.
- Removed dead React code (`src/components/` — 7 files) and associated dependencies (`react`, `react-dom`, `recharts`).
- Fixed memory leak: added `AbortController` for suggestion click listener cleanup in `InlineWorkoutEditor`.
- Split `WorkoutMarkdownProcessor` (896 → 605 lines): extracted `stats-view.ts`, `list-view.ts`, `workout-card.ts`, `year-view.ts` into `src/processors/views/`.
- Split `InlineWorkoutEditor` (1119 → 597 lines): extracted `exercise-form.ts`, `exercise-suggestions.ts`, `create-exercise-form.ts` into `src/processors/forms/`.
- Consolidated 12 root-level development docs into single `CHANGELOG.md`.

---

## [0.1.0] — Initial development

### Architecture
- Switched from sidebar panel to inline markdown code block processors (`\`\`\`workout` and `\`\`\`exercises` blocks).
- All UI rendered via DOM API within markdown files.
- Data persisted as JSON inside code blocks for Dataview compatibility.

### Features — Workout management
- **Calendar views**: Week, month, and year display modes with navigation.
- **Workout CRUD**: Add, edit, delete workouts via fullscreen modals.
- **Drag-and-drop**: Reorder exercises within a workout and move workouts between days.
- **Status system**: Planned, done, skipped, illness — with color coding.
- **Exercise management**: Add/edit exercises with sets, reps, weight, intensity (% of 1RM).
- **1RM tracking**: Auto-calculation of intensity from weight and vice versa; auto-fill from exercise library.
- **Autocomplete**: Exercise name suggestions from library and past workouts; inline "create new exercise" option.
- **Today highlight**: Current date visually distinguished in all calendar views.

### Features — Exercise library
- `\`\`\`exercises` block processor for managing exercise reference data.
- Searchable, filterable library grouped by muscle group.
- Color-coded muscle group pills with luminance-aware text contrast.
- CRUD operations for exercises with muscle group, description, difficulty, 1RM history.

### Features — File management
- **Commands**: "Create workout file", "Create workout template", "Quick add workout".
- **Modals**: `WorkoutFileModal`, `WorkoutTemplateModal`, `QuickWorkoutModal`.
- Action buttons in workout block header (add workout, new file, template).

### Features — Settings
- Customizable workout types.
- Settings tab with plugin configuration.
- Data persistence via `loadData()` / `saveData()`.

### Bug fixes
- Fixed "File already exists" error on initial load — graceful fallback to empty data.
- Fixed modal overlay not cleaning up after close (ESC, backdrop click).
- Fixed navigation bar duplication when switching week/month modes.
- Fixed month view showing only one week instead of four.
- Fixed exercise data loss when adding new exercises to a workout form.
- Fixed Russian keyboard input blocking in exercise name field (replaced `blur` with debounced `input`).
- Fixed compact view hiding exercises — now shows full detail in all modes.
- Fixed form contrast issues (white text on green background) with CSS variable usage.

### UI/UX
- Fullscreen modals with backdrop blur and ESC/click-outside close.
- Responsive CSS grid for year view (12 month cards).
- Animated hover effects on month cards and buttons.
- Numbered sets display (ordered list) in workout cards.
- Status-colored select fields in forms.
- Increased input field sizes and improved typography.
