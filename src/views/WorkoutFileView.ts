import { TextFileView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { WorkoutData, WorkoutEntry, WorkoutStatus } from '../types';
import { InlineWorkoutEditor } from '../processors/InlineWorkoutEditor';
import { renderStatsView } from '../processors/views/stats-view';
import { renderListView } from '../processors/views/list-view';
import { renderWorkoutCard } from '../processors/views/workout-card';
import { renderYearView } from '../processors/views/year-view';
import { statusToClass } from '../utils/status-utils';
import type WorkoutTrackerPlugin from '../main';

export const WORKOUT_VIEW_TYPE = 'workout-tracker-view';
const FRONTMATTER_KEY = 'workout-tracker';

/**
 * Определяет, содержит ли markdown текст фронтматтер workout-tracker: true
 */
export function hasWorkoutFrontmatter(data: string): boolean {
  const fmMatch = data.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return false;
  return /^workout-tracker:\s*true$/m.test(fmMatch[1]);
}

/**
 * Парсит содержимое файла: отделяет фронтматтер от JSON body
 */
function parseFileContent(raw: string): { frontmatter: string; body: string } {
  const fmMatch = raw.match(/^(---\r?\n[\s\S]*?\r?\n---)\r?\n?([\s\S]*)$/);
  if (fmMatch) {
    return { frontmatter: fmMatch[1], body: fmMatch[2].trim() };
  }
  return { frontmatter: '', body: raw.trim() };
}

/**
 * TextFileView-based view for .md files with workout-tracker: true frontmatter.
 * Works similarly to the obsidian-kanban plugin: overrides the default markdown
 * rendering with a fully interactive workout tracker UI.
 */
export class WorkoutFileView extends TextFileView {
  plugin: WorkoutTrackerPlugin;

  private workoutData: WorkoutData = {};
  private rawFrontmatter = '';
  private currentView: 'calendar' | 'list' | 'stats' = 'calendar';
  private currentDate: Date = new Date();
  private displayMode: 'week' | 'month' | 'year' = 'week';
  private editor: InlineWorkoutEditor | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: WorkoutTrackerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return WORKOUT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? 'Тренировки';
  }

  getIcon(): string {
    return 'dumbbell';
  }

  // ── TextFileView contract ──

  /** Called by Obsidian when file content should be loaded into the view */
  setViewData(data: string, clear: boolean): void {
    if (clear) this.clear();

    const parsed = parseFileContent(data);
    this.rawFrontmatter = parsed.frontmatter;

    try {
      this.workoutData = parsed.body ? JSON.parse(parsed.body) : {};
    } catch {
      this.workoutData = {};
    }

    this.render();
  }

  /** Called by Obsidian when it needs to serialize the view back to file text */
  getViewData(): string {
    const json = JSON.stringify(this.workoutData, null, 2);
    if (this.rawFrontmatter) {
      return this.rawFrontmatter + '\n' + json + '\n';
    }
    return '---\nworkout-tracker: true\n---\n' + json + '\n';
  }

  clear(): void {
    this.contentEl.empty();
    this.workoutData = {};
    this.editor = null;
  }

  // ── Rendering ──

  private render() {
    this.contentEl.empty();
    this.contentEl.addClass('workout-interactive-view', 'workout-file-view');

    // Prevent Obsidian hotkey system from intercepting keystrokes in our inputs
    this.contentEl.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        if (e.key !== 'Escape') {
          e.stopPropagation();
        }
      }
    });

    // Create a mock MarkdownPostProcessorContext so InlineWorkoutEditor can be reused
    const mockCtx = this.createMockContext();

    this.editor = new InlineWorkoutEditor(
      this.plugin,
      this.contentEl,
      this.workoutData,
      mockCtx,
      JSON.stringify(this.workoutData)
    );

    // Header
    const header = this.contentEl.createDiv({ cls: 'workout-header' });
    header.createEl('h3', { text: 'Тренировки', cls: 'workout-title' });

    const controls = header.createDiv({ cls: 'workout-controls' });

    const addBtn = controls.createEl('button', {
      text: '+ Добавить тренировку',
      cls: 'workout-btn workout-btn-primary'
    });
    addBtn.addEventListener('click', () => {
      this.editor?.showAddWorkoutForm();
    });

    // View switcher
    const viewSwitcher = controls.createDiv({ cls: 'workout-view-switcher' });
    this.createViewSwitcher(viewSwitcher);

    // Data container
    const dataContainer = this.contentEl.createDiv({ cls: 'workout-data-container' });
    this.renderCurrentView(dataContainer);
  }

  private createViewSwitcher(container: HTMLElement) {
    const views = [
      { id: 'calendar', label: 'Календарь', icon: '📅' },
      { id: 'list', label: 'Список', icon: '📋' },
      { id: 'stats', label: 'Статистика', icon: '📊' }
    ];

    views.forEach(v => {
      const btn = container.createEl('button', {
        text: `${v.icon} ${v.label}`,
        cls: `workout-view-btn ${this.currentView === v.id ? 'active' : ''}`
      });

      btn.addEventListener('click', () => {
        container.querySelectorAll('.workout-view-btn').forEach(b => b.removeClass('active'));
        btn.addClass('active');
        this.currentView = v.id as typeof this.currentView;

        const dc = this.contentEl.querySelector('.workout-data-container') as HTMLElement;
        if (dc) {
          dc.empty();
          this.renderCurrentView(dc);
        }
      });
    });
  }

  private renderCurrentView(container: HTMLElement) {
    if (!this.editor) return;

    switch (this.currentView) {
      case 'calendar':
        this.renderCalendarView(container);
        break;
      case 'list':
        renderListView(container, this.workoutData, this.editor);
        break;
      case 'stats':
        renderStatsView(container, this.workoutData);
        break;
    }
  }

  // ── Calendar view (week/month/year tabs) – mirrors WorkoutMarkdownProcessor ──

  private renderCalendarView(container: HTMLElement) {
    if (!this.editor) return;

    const calNav = container.createDiv({ cls: 'workout-calendar-nav' });

    // Display mode switches (week / month / year)
    const modeContainer = calNav.createDiv({ cls: 'workout-display-modes' });
    const modes: { id: 'week' | 'month' | 'year'; label: string }[] = [
      { id: 'week', label: 'Неделя' },
      { id: 'month', label: 'Месяц' },
      { id: 'year', label: 'Год' },
    ];

    modes.forEach(m => {
      const btn = modeContainer.createEl('button', {
        text: m.label,
        cls: `workout-mode-btn ${this.displayMode === m.id ? 'active' : ''}`
      });
      btn.addEventListener('click', () => {
        this.displayMode = m.id;
        modeContainer.querySelectorAll('.workout-mode-btn').forEach(b => b.removeClass('active'));
        btn.addClass('active');
        calContent.empty();
        this.renderCalendarContent(calContent);
      });
    });

    // Prev / Today / Next navigation
    const navBtns = calNav.createDiv({ cls: 'workout-nav-buttons' });

    const prevBtn = navBtns.createEl('button', { text: '←', cls: 'workout-btn' });
    prevBtn.addEventListener('click', () => {
      this.navigateCalendar(-1);
      calContent.empty();
      this.renderCalendarContent(calContent);
    });

    const todayBtn = navBtns.createEl('button', { text: 'Сегодня', cls: 'workout-btn' });
    todayBtn.addEventListener('click', () => {
      this.currentDate = new Date();
      calContent.empty();
      this.renderCalendarContent(calContent);
    });

    const nextBtn = navBtns.createEl('button', { text: '→', cls: 'workout-btn' });
    nextBtn.addEventListener('click', () => {
      this.navigateCalendar(1);
      calContent.empty();
      this.renderCalendarContent(calContent);
    });

    const calContent = container.createDiv({ cls: 'workout-calendar-content' });
    this.renderCalendarContent(calContent);
  }

  private navigateCalendar(direction: number) {
    switch (this.displayMode) {
      case 'week':
        this.currentDate.setDate(this.currentDate.getDate() + direction * 7);
        break;
      case 'month':
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        break;
      case 'year':
        this.currentDate.setFullYear(this.currentDate.getFullYear() + direction);
        break;
    }
  }

  private renderCalendarContent(container: HTMLElement) {
    if (!this.editor) return;

    switch (this.displayMode) {
      case 'week':
        this.renderWeekView(container);
        break;
      case 'month':
        this.renderMonthView(container);
        break;
      case 'year':
        renderYearView(container, this.currentDate, this.workoutData, (year, month) => {
          this.currentDate = new Date(year, month, 1);
          this.displayMode = 'month';
          const dc = this.contentEl.querySelector('.workout-data-container') as HTMLElement;
          if (dc) { dc.empty(); this.renderCurrentView(dc); }
        });
        break;
    }
  }

  private renderWeekView(container: HTMLElement) {
    if (!this.editor) return;

    const startOfWeek = new Date(this.currentDate);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diff);

    const weekGrid = container.createDiv({ cls: 'workout-week-grid' });
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const workout = this.workoutData[dateStr];
      const isToday = dateStr === new Date().toISOString().split('T')[0];

      const dayCol = weekGrid.createDiv({
        cls: `workout-day-column ${isToday ? 'workout-today' : ''} ${workout ? statusToClass(workout.status) : ''}`
      });

      dayCol.createEl('div', {
        text: `${dayNames[i]} ${date.getDate()}`,
        cls: 'workout-day-header'
      });

      if (workout) {
        renderWorkoutCard(dayCol, workout, dateStr, this.workoutData, this.editor!);
      } else {
        const emptyDay = dayCol.createDiv({ cls: 'workout-empty-day' });
        const addDayBtn = emptyDay.createEl('button', { text: '+', cls: 'workout-add-day-btn' });
        addDayBtn.addEventListener('click', () => {
          this.editor?.showAddWorkoutForm(dateStr);
        });
      }
    }
  }

  private renderMonthView(container: HTMLElement) {
    if (!this.editor) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    container.createEl('h4', {
      text: firstDay.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
      cls: 'workout-month-title'
    });

    const monthGrid = container.createDiv({ cls: 'workout-month-grid' });
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayNames.forEach(n => monthGrid.createEl('div', { text: n, cls: 'workout-month-header' }));

    let startDow = firstDay.getDay();
    if (startDow === 0) startDow = 7;

    for (let i = 1; i < startDow; i++) {
      monthGrid.createEl('div', { cls: 'workout-month-empty' });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const workout = this.workoutData[dateStr];
      const isToday = dateStr === new Date().toISOString().split('T')[0];

      const cell = monthGrid.createDiv({
        cls: `workout-month-cell ${isToday ? 'workout-today' : ''} ${workout ? statusToClass(workout.status) : ''}`
      });

      cell.createEl('span', { text: String(d), cls: 'workout-month-day-number' });

      if (workout) {
        cell.createEl('span', { text: workout.type, cls: 'workout-month-type' });
      }

      cell.addEventListener('click', () => {
        if (workout) {
          this.editor?.showEditWorkoutForm(dateStr, workout);
        } else {
          this.editor?.showAddWorkoutForm(dateStr);
        }
      });
    }
  }

  // ── Persistence ──

  /** Save current data back to the file via Obsidian's vault API */
  async saveWorkoutData() {
    this.requestSave();
  }

  /** Called by InlineWorkoutEditor after edits – re-read from own data and re-render */
  async refreshAfterEdit() {
    // Let Obsidian persist the file first
    this.requestSave();
    // Re-render UI with the updated in-memory data
    this.render();
  }

  // ── Mock MarkdownPostProcessorContext ──

  private createMockContext(): any {
    const self = this;
    return {
      sourcePath: this.file?.path ?? '',
      frontmatter: null,
      addChild: () => {},
      getSectionInfo: () => null,
      // The workout editor calls updateWorkout which reads context
      // We override the actual file write
    };
  }
}
