import { MarkdownPostProcessorContext, Plugin } from 'obsidian';
import { WorkoutData, WorkoutEntry, WorkoutStatus } from '../types';
import { WorkoutDataUtils } from '../utils/data-utils';
import { InlineWorkoutEditor } from './InlineWorkoutEditor';
import { ExerciseLibraryManager } from './ExerciseLibraryManager';
import { renderStatsView } from './views/stats-view';
import { renderListView } from './views/list-view';
import { renderWorkoutCard } from './views/workout-card';
import { renderYearView } from './views/year-view';
import WorkoutTrackerPlugin from '../main';

/**
 * Процессор для обработки блоков ```workout в markdown файлах
 */
export class WorkoutMarkdownProcessor {
  private plugin: WorkoutTrackerPlugin;
  private currentView: 'calendar' | 'list' | 'stats' = 'calendar';
  private currentDate: Date = new Date(); // Добавляем текущую дату для навигации
  private displayMode: 'week' | 'month' | 'year' = 'week'; // Режим отображения календаря

  constructor(plugin: WorkoutTrackerPlugin) {
    this.plugin = plugin;
  }

  /**
   * Регистрирует процессор markdown для блоков workout
   */
  register() {
    this.plugin.registerMarkdownCodeBlockProcessor('workout', (source, el, ctx) => {
      this.processWorkoutBlock(source, el, ctx);
    });
    
    // Регистрируем процессор для справочника упражнений
    this.plugin.registerMarkdownCodeBlockProcessor('exercises', (source, el, ctx) => {
      this.processExercisesBlock(source, el, ctx);
    });
  }

  /**
   * Обрабатывает блок с данными тренировок
   */
  private async processWorkoutBlock(
    source: string, 
    element: HTMLElement, 
    context: MarkdownPostProcessorContext
  ) {
    try {
      const workoutData: WorkoutData = JSON.parse(source);
      
      // Очищаем исходный элемент
      element.empty();
      
      // Создаем интерактивный интерфейс
      this.createInteractiveWorkoutView(element, workoutData, context, source);
      
    } catch (error) {
      console.error('Error parsing workout data:', error);
      element.createEl('div', { 
        text: 'Ошибка парсинга данных тренировок', 
        cls: 'workout-error' 
      });
    }
  }

  /**
   * Обрабатывает блок со справочником упражнений
   */
  private async processExercisesBlock(
    source: string,
    element: HTMLElement,
    context: MarkdownPostProcessorContext
  ) {
    try {
      // Очищаем исходный элемент
      element.empty();
      
      // Создаем менеджер библиотеки упражнений
      const libraryManager = new ExerciseLibraryManager(this.plugin);
      await libraryManager.render(element, context);
      
    } catch (error) {
      console.error('Error rendering exercise library:', error);
      element.createEl('div', { 
        text: 'Ошибка загрузки справочника упражнений', 
        cls: 'workout-error' 
      });
    }
  }

  /**
   * Создает интерактивный вид тренировок
   */
  private createInteractiveWorkoutView(
    container: HTMLElement, 
    workoutData: WorkoutData, 
    context: MarkdownPostProcessorContext,
    originalSource: string
  ) {
    container.addClass('workout-interactive-view');

    // Создаем ключ для сохранения состояния
    const blockKey = context.sourcePath + ':' + (context.frontmatter?.position?.start?.line?.toString() || '0');

    // Создаем редактор для этого контейнера
    const editor = new InlineWorkoutEditor(
      this.plugin,
      container,
      workoutData,
      context,
      originalSource
    );

    // Заголовок с кнопками управления
    const header = container.createDiv({ cls: 'workout-header' });
    header.createEl('h3', { text: 'Тренировки', cls: 'workout-title' });
    
    const controls = header.createDiv({ cls: 'workout-controls' });
    
    // Кнопка добавления новой тренировки
    const addBtn = controls.createEl('button', { 
      text: '+ Добавить тренировку',
      cls: 'workout-btn workout-btn-primary'
    });
    addBtn.addEventListener('click', () => {
      editor.showAddWorkoutForm();
    });

    // Переключатель вида
    const viewSwitcher = controls.createDiv({ cls: 'workout-view-switcher' });
    this.createViewSwitcher(viewSwitcher, container, workoutData, context, editor);

    // Контейнер для данных
    const dataContainer = container.createDiv({ cls: 'workout-data-container' });
    
    // По умолчанию показываем календарный вид
    this.renderCalendarView(dataContainer, workoutData, context, editor);
  }

  /**
   * Создает переключатель видов
   */
  private createViewSwitcher(
    container: HTMLElement, 
    mainContainer: HTMLElement,
    workoutData: WorkoutData, 
    context: MarkdownPostProcessorContext,
    editor: InlineWorkoutEditor
  ) {
    const views = [
      { id: 'calendar', label: 'Календарь', icon: '📅' },
      { id: 'list', label: 'Список', icon: '📋' },
      { id: 'stats', label: 'Статистика', icon: '📊' }
    ];

    let currentView = 'calendar';

    views.forEach(view => {
      const btn = container.createEl('button', {
        text: `${view.icon} ${view.label}`,
        cls: `workout-view-btn ${currentView === view.id ? 'active' : ''}`
      });

      btn.addEventListener('click', () => {
        // Обновляем активную кнопку
        container.querySelectorAll('.workout-view-btn').forEach(b => b.removeClass('active'));
        btn.addClass('active');
        currentView = view.id;
        this.currentView = view.id as 'calendar' | 'list' | 'stats';

        // Перерисовываем контент
        const dataContainer = mainContainer.querySelector('.workout-data-container') as HTMLElement;
        if (dataContainer) {
          dataContainer.empty();
          this.renderView(view.id, dataContainer, workoutData, context, editor);
        }
      });
    });
  }

  /**
   * Отрисовывает выбранный вид
   */
  private renderView(viewId: string, container: HTMLElement, workoutData: WorkoutData, context: MarkdownPostProcessorContext, editor: InlineWorkoutEditor) {
    switch (viewId) {
      case 'calendar':
        this.renderCalendarView(container, workoutData, context, editor);
        break;
      case 'list':
        renderListView(container, workoutData, editor);
        break;
      case 'stats':
        renderStatsView(container, workoutData);
        break;
    }
  }

    /**
   * Календарный вид тренировок
   */
  private renderCalendarView(container: HTMLElement, workoutData: WorkoutData, context: MarkdownPostProcessorContext, editor: InlineWorkoutEditor) {
    container.addClass('workout-calendar-view');

    // Добавляем навигацию только если её ещё нет
    let navigationContainer = container.querySelector('.workout-navigation') as HTMLElement;
    if (!navigationContainer) {
      navigationContainer = container.createDiv({ cls: 'workout-navigation' });
      this.createNavigationControls(navigationContainer, container, workoutData, context, editor);
    }

    // Создаем или обновляем контейнер для недель
    this.renderWeeksContent(container, workoutData, context, editor);
  }

  /**
   * Отображает содержимое недель
   */
  private renderWeeksContent(container: HTMLElement, workoutData: WorkoutData, context: MarkdownPostProcessorContext, editor: InlineWorkoutEditor) {
    // Удаляем старый контейнер недель если есть
    const existingWeeks = container.querySelector('.workout-weeks-container');
    if (existingWeeks) {
      existingWeeks.remove();
    }

    // Создаем новый контейнер для недель
    const weeksContainer = container.createDiv({ cls: 'workout-weeks-container' });

    if (this.displayMode === 'year') {
      renderYearView(weeksContainer, this.currentDate, workoutData, (year, month) => {
        this.displayMode = 'month';
        this.currentDate = new Date(year, month, 1);
        this.refreshCalendarView(
          weeksContainer.closest('.workout-weeks-container')!.parentElement!,
          workoutData, context, editor
        );
      });
    } else {
      // Определяем количество недель для отображения
      const weeksToShow = this.displayMode === 'month' ? 4 : 1;
      
      for (let weekOffset = 0; weekOffset < weeksToShow; weekOffset++) {
        const weekStart = new Date(this.currentDate);
        weekStart.setDate(weekStart.getDate() + (weekOffset * 7));
        
        // Корректируем до понедельника
        const dayOfWeek = weekStart.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        weekStart.setDate(weekStart.getDate() + mondayOffset);

        this.renderSingleWeek(weeksContainer, weekStart, workoutData, context, editor);
      }
    }
  }

  /**
   * Отображает одну неделю
   */
  private renderSingleWeek(
    container: HTMLElement, 
    weekStart: Date, 
    workoutData: WorkoutData, 
    context: MarkdownPostProcessorContext, 
    editor: InlineWorkoutEditor
  ) {
    const weekDates = this.getWeekDates(weekStart);
    const weekContainer = container.createDiv({ cls: 'workout-week' });

    // Заголовок недели (только для месячного вида)
    if (this.displayMode === 'month') {
      const weekHeader = weekContainer.createDiv({ cls: 'workout-week-header' });
      const startDate = new Date(weekDates[0]);
      const endDate = new Date(weekDates[6]);
      weekHeader.textContent = `${this.formatDateShort(startDate)} - ${this.formatDateShort(endDate)}`;
    }

    weekDates.forEach(dateStr => {
      const dayContainer = weekContainer.createDiv({ cls: 'workout-day' });
      const date = new Date(dateStr);
      
      // Проверяем, является ли день сегодняшним
      const today = new Date();
      const isToday = dateStr === today.toISOString().split('T')[0];
      if (isToday) {
        dayContainer.addClass('today');
      }
      
      // Заголовок дня
      const dayHeader = dayContainer.createDiv({ cls: 'workout-day-header' });
      dayHeader.createSpan({ text: this.getDayName(date), cls: 'day-name' });
      dayHeader.createSpan({ text: date.getDate().toString(), cls: 'day-number' });

      // Добавляем индикатор для дней из других месяцев
      if (date.getMonth() !== this.currentDate.getMonth()) {
        dayHeader.addClass('other-month');
      }

      // Данные тренировки
      const workout = workoutData[dateStr];
      const dayContent = dayContainer.createDiv({ cls: 'workout-day-content' });

      // Добавляем drop zone
      this.setupDropZone(dayContent, dateStr, workoutData, editor);

      if (workout) {
        renderWorkoutCard(dayContent, workout, dateStr, workoutData, editor, true);
      } else {
        // Пустой день с кнопкой добавления
        const emptyDay = dayContent.createDiv({ cls: 'workout-empty-day' });
        const addBtn = emptyDay.createEl('button', {
          text: '+',
          cls: 'workout-add-btn'
        });
        addBtn.addEventListener('click', () => {
          editor.showAddWorkoutForm(dateStr);
        });
      }
    });
  }

  /**
   * Настраивает drop zone для drag-n-drop тренировок
   */
  private setupDropZone(element: HTMLElement, targetDate: string, workoutData: WorkoutData, editor: InlineWorkoutEditor) {
    element.classList.add('workout-drop-zone');
    
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      element.classList.add('workout-dropping');
    });

    element.addEventListener('dragleave', (e) => {
      // Проверяем, что мы действительно покинули элемент
      if (!element.contains(e.relatedTarget as Node)) {
        element.classList.remove('workout-dropping');
      }
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('workout-dropping');
      
      const sourceDate = e.dataTransfer?.getData('text/plain');
      if (sourceDate && sourceDate !== targetDate) {
        this.moveWorkout(sourceDate, targetDate, workoutData, editor);
      }
    });
  }

  private moveWorkout(sourceDate: string, targetDate: string, workoutData: any, editor: InlineWorkoutEditor) {
    // Перемещаем тренировку
    const workoutToMove = workoutData[sourceDate];
    if (workoutToMove) {
      // Если в целевой дате уже есть тренировка, спрашиваем подтверждение
      if (workoutData[targetDate]) {
        const confirmed = confirm('В этот день уже есть тренировка. Заменить её?');
        if (!confirmed) return;
      }

      // Перемещаем
      workoutData[targetDate] = workoutToMove;
      delete workoutData[sourceDate];

      // Обновляем отображение
      editor.updateWorkoutData(workoutData);
    }
  }

  /**
   * Создает навигационные элементы
   */
  private createNavigationControls(
    container: HTMLElement, 
    dataContainer: HTMLElement, 
    workoutData: WorkoutData, 
    context: MarkdownPostProcessorContext, 
    editor: InlineWorkoutEditor
  ) {
    const navControls = container.createDiv({ cls: 'workout-nav-controls' });

    // Переключатели режимов отображения
    const modeButtons = navControls.createDiv({ cls: 'workout-mode-buttons' });
    
    const weekModeBtn = modeButtons.createEl('button', {
      text: 'Неделя',
      cls: `workout-mode-btn ${this.displayMode === 'week' ? 'active' : ''}`
    });
    
    const monthModeBtn = modeButtons.createEl('button', {
      text: 'Месяц',
      cls: `workout-mode-btn ${this.displayMode === 'month' ? 'active' : ''}`
    });
    
    const yearModeBtn = modeButtons.createEl('button', {
      text: 'Год',
      cls: `workout-mode-btn ${this.displayMode === 'year' ? 'active' : ''}`
    });

    // Навигация по периодам
    const periodNav = navControls.createDiv({ cls: 'workout-period-nav' });
    
    const prevBtn = periodNav.createEl('button', {
      text: '‹',
      cls: 'workout-nav-btn workout-nav-prev'
    });

    const currentPeriod = periodNav.createDiv({ cls: 'workout-current-period' });
    this.updateCurrentPeriodDisplay(currentPeriod);

    const nextBtn = periodNav.createEl('button', {
      text: '›',
      cls: 'workout-nav-btn workout-nav-next'
    });

    // Кнопка "Сегодня"
    const todayBtn = periodNav.createEl('button', {
      text: 'Сегодня',
      cls: 'workout-nav-btn workout-nav-today'
    });

    // Обработчики для переключения режимов
    weekModeBtn.addEventListener('click', () => {
      this.displayMode = 'week';
      this.refreshDisplay(modeButtons, dataContainer, workoutData, context, editor);
    });

    monthModeBtn.addEventListener('click', () => {
      this.displayMode = 'month';
      this.refreshDisplay(modeButtons, dataContainer, workoutData, context, editor);
    });

    yearModeBtn.addEventListener('click', () => {
      this.displayMode = 'year';
      this.refreshDisplay(modeButtons, dataContainer, workoutData, context, editor);
    });

    // Обработчики для навигации
    prevBtn.addEventListener('click', () => {
      this.navigatePrevious();
      this.refreshCalendarView(dataContainer, workoutData, context, editor);
    });

    nextBtn.addEventListener('click', () => {
      this.navigateNext();
      this.refreshCalendarView(dataContainer, workoutData, context, editor);
    });

    todayBtn.addEventListener('click', () => {
      this.currentDate = new Date();
      this.refreshCalendarView(dataContainer, workoutData, context, editor);
    });
  }

  /**
   * Навигация назад в зависимости от режима
   */
  private navigatePrevious() {
    switch (this.displayMode) {
      case 'week':
        this.currentDate.setDate(this.currentDate.getDate() - 7);
        break;
      case 'month':
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        break;
      case 'year':
        this.currentDate.setFullYear(this.currentDate.getFullYear() - 1);
        break;
    }
  }

  /**
   * Навигация вперед в зависимости от режима
   */
  private navigateNext() {
    switch (this.displayMode) {
      case 'week':
        this.currentDate.setDate(this.currentDate.getDate() + 7);
        break;
      case 'month':
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        break;
      case 'year':
        this.currentDate.setFullYear(this.currentDate.getFullYear() + 1);
        break;
    }
  }

  /**
   * Обновляет активные кнопки режимов и перерисовывает календарь
   */
  private refreshDisplay(
    modeButtonsContainer: HTMLElement,
    dataContainer: HTMLElement,
    workoutData: WorkoutData,
    context: MarkdownPostProcessorContext,
    editor: InlineWorkoutEditor
  ) {
    // Обновляем активные кнопки
    modeButtonsContainer.querySelectorAll('.workout-mode-btn').forEach(btn => {
      btn.removeClass('active');
    });
    modeButtonsContainer.querySelector(`.workout-mode-btn:nth-child(${this.displayMode === 'week' ? 1 : this.displayMode === 'month' ? 2 : 3})`)?.addClass('active');
    
    // Перерисовываем календарь
    this.refreshCalendarView(dataContainer, workoutData, context, editor);
  }

  /**
   * Обновляет отображение текущего периода
   */
  private updateCurrentPeriodDisplay(container: HTMLElement) {
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    switch (this.displayMode) {
      case 'year':
        container.innerHTML = `
          <div class="workout-week-range">
            ${this.currentDate.getFullYear()} год
          </div>
          <div class="workout-month-year">
            Годовой обзор
          </div>
        `;
        break;
      case 'month':
        container.innerHTML = `
          <div class="workout-week-range">
            ${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}
          </div>
          <div class="workout-month-year">
            Месячный вид (4 недели)
          </div>
        `;
        break;
      default: // week
        const weekDates = this.getWeekDates(this.currentDate);
        const startDate = new Date(weekDates[0]);
        const endDate = new Date(weekDates[6]);
        
        container.innerHTML = `
          <div class="workout-week-range">
            ${this.formatDateShort(startDate)} - ${this.formatDateShort(endDate)}
          </div>
          <div class="workout-month-year">
            ${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}
          </div>
        `;
        break;
    }
  }

  /**
   * Обновляет календарный вид
   */
  private refreshCalendarView(
    container: HTMLElement, 
    workoutData: WorkoutData, 
    context: MarkdownPostProcessorContext, 
    editor: InlineWorkoutEditor
  ) {
    // Находим контейнер периода и обновляем его
    const periodContainer = container.querySelector('.workout-current-period') as HTMLElement;
    if (periodContainer) {
      this.updateCurrentPeriodDisplay(periodContainer);
    }

    // Обновляем только содержимое недель, не всю навигацию
    this.renderWeeksContent(container, workoutData, context, editor);
  }

  // Вспомогательные методы
  private getWeekDates(date: Date): string[] {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      week.push(currentDate.toISOString().split('T')[0]);
    }
    return week;
  }

  private getDayName(date: Date): string {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[date.getDay()];
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU');
  }

  private formatDateShort(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}`;
  }

}