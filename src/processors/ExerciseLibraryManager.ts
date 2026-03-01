import { MarkdownPostProcessorContext } from 'obsidian';
import { ExerciseSpec, ExerciseLibrary, OneRMRecord } from '../types';
import { createFullscreenModal, hideModal as hideFullscreenModal, applyLuminanceColor } from '../utils/dom-helpers';
import WorkoutTrackerPlugin from '../main';

/**
 * Компонент для управления справочником упражнений
 */
export class ExerciseLibraryManager {
  private plugin: WorkoutTrackerPlugin;
  private container: HTMLElement;
  private library: ExerciseLibrary = { exercises: {} };

  constructor(plugin: WorkoutTrackerPlugin) {
    this.plugin = plugin;
  }

  /**
   * Отображает справочник упражнений в контейнере
   */
  async render(container: HTMLElement, context: MarkdownPostProcessorContext) {
    this.container = container;
    await this.loadExerciseLibrary();
    this.renderLibraryView();
  }

  /**
   * Загружает библиотеку упражнений
   */
  private async loadExerciseLibrary() {
    try {
      this.library = await this.plugin.dataManager.loadExerciseLibrary();
    } catch (error) {
      console.error('Error loading exercise library:', error);
      this.library = { exercises: {} };
    }
  }

  /**
   * Отображает интерфейс библиотеки упражнений
   */
  private renderLibraryView() {
    this.container.empty();
    this.container.addClass('exercise-library-view');

    // Заголовок с кнопками управления
    const header = this.container.createDiv({ cls: 'exercise-library-header' });
    header.createEl('h3', { text: 'Справочник упражнений', cls: 'exercise-library-title' });
    
    const controls = header.createDiv({ cls: 'exercise-library-controls' });
    
    const addBtn = controls.createEl('button', { 
      text: '+ Добавить упражнение',
      cls: 'exercise-btn exercise-btn-primary'
    });
    addBtn.addEventListener('click', () => {
      this.showAddExerciseForm();
    });

    // Поиск и фильтрация
    const searchContainer = this.container.createDiv({ cls: 'exercise-search-container' });
    
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Поиск упражнений...',
      cls: 'exercise-search-input'
    });

    const categoryFilter = searchContainer.createEl('select', { cls: 'exercise-category-filter' });
    categoryFilter.createEl('option', { value: '', text: 'Все категории' });
    this.getUniqueCategories().forEach(category => {
      categoryFilter.createEl('option', { value: category, text: category });
    });

    // Список упражнений
    const exercisesList = this.container.createDiv({ cls: 'exercises-list' });

    // Обработчики поиска и фильтрации
    searchInput.addEventListener('input', () => {
      this.filterExercises(exercisesList, searchInput.value, categoryFilter.value);
    });

    categoryFilter.addEventListener('change', () => {
      this.filterExercises(exercisesList, searchInput.value, categoryFilter.value);
    });

    // Начальное отображение всех упражнений
    this.renderExercisesList(exercisesList);
  }

  /**
   * Отображает список упражнений
   */
  private renderExercisesList(container: HTMLElement, searchTerm = '', categoryFilter = '') {
    container.empty();

    const exercises = Object.entries(this.library.exercises);
    
    if (exercises.length === 0) {
      container.createEl('div', {
        text: 'Упражнения не найдены. Добавьте первое упражнение!',
        cls: 'exercise-empty-state'
      });
      return;
    }

    const filteredExercises = exercises.filter(([name, exercise]) => {
      const matchesSearch = !searchTerm || 
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exercise.description && exercise.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = !categoryFilter || exercise.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });

    // Группировка по категориям
    const groupedExercises = this.groupExercisesByCategory(filteredExercises);

    Object.entries(groupedExercises).forEach(([category, exercises]) => {
      // Заголовок категории
      const categoryHeader = container.createDiv({ cls: 'exercise-category-header' });
      categoryHeader.createEl('h4', { text: category, cls: 'exercise-category-title' });
      categoryHeader.createEl('span', { 
        text: `${exercises.length} упр.`, 
        cls: 'exercise-category-count' 
      });

      // Упражнения в категории
      const categoryContainer = container.createDiv({ cls: 'exercise-category-container' });
      
      exercises.forEach(([name, exercise]) => {
        this.renderExerciseCard(categoryContainer, name, exercise);
      });
    });
  }

  /**
   * Отображает карточку упражнения
   */
  private renderExerciseCard(container: HTMLElement, name: string, exercise: ExerciseSpec) {
    const card = container.createDiv({ cls: 'exercise-card' });

    // Заголовок упражнения
    const header = card.createDiv({ cls: 'exercise-card-header' });
    header.createEl('h5', { text: name, cls: 'exercise-card-title' });
    
    const actions = header.createDiv({ cls: 'exercise-card-actions' });
    
    const editBtn = actions.createEl('button', {
      text: '✏️',
      cls: 'exercise-action-btn',
      attr: { title: 'Редактировать' }
    });
    editBtn.addEventListener('click', () => {
      this.showEditExerciseForm(name, exercise);
    });

    const deleteBtn = actions.createEl('button', {
      text: '🗑️',
      cls: 'exercise-action-btn exercise-delete-btn',
      attr: { title: 'Удалить' }
    });
    deleteBtn.addEventListener('click', () => {
      this.deleteExercise(name);
    });

    // Информация об упражнении
    const info = card.createDiv({ cls: 'exercise-card-info' });
    
    if (exercise.category) {
      const categoryBadge = info.createDiv({ cls: 'exercise-badge' });
      categoryBadge.textContent = exercise.category;
    }

    if (exercise.equipment) {
      const equipmentBadge = info.createDiv({ cls: 'exercise-badge exercise-equipment' });
      equipmentBadge.textContent = exercise.equipment;
    }

    if (exercise.difficulty) {
      const difficultyBadge = info.createDiv({ 
        cls: `exercise-badge exercise-difficulty exercise-${exercise.difficulty}` 
      });
      difficultyBadge.textContent = exercise.difficulty;
    }

    if (exercise.description) {
      const description = card.createDiv({ cls: 'exercise-card-description' });
      description.textContent = exercise.description;
    }

    if (exercise.muscleGroups && exercise.muscleGroups.length > 0) {
      const muscleGroups = card.createDiv({ cls: 'exercise-muscle-groups' });
      muscleGroups.createEl('strong', { text: 'Мышечные группы: ' });
      // render each muscle group as a pill for better contrast
      exercise.muscleGroups.forEach(mg => {
        const span = muscleGroups.createSpan({ text: mg, cls: 'group-name pill' });
        span.style.marginRight = '6px';
        // apply label background from exercise spec if provided
        if (exercise.labelBackground) {
          applyLuminanceColor(span, exercise.labelBackground);
        }
      });
    }

    // If exercise has 1RM history, show latest record
    if (exercise.oneRMHistory && exercise.oneRMHistory.length > 0) {
      const lastUpdate = exercise.oneRMHistory[exercise.oneRMHistory.length - 1];
      const oneRMInfo = card.createDiv({ cls: 'exercise-one-rm' });
      oneRMInfo.createEl('strong', { text: 'Последний 1ПМ: ' });
      oneRMInfo.createSpan({ text: `${lastUpdate.value} кг` });
      const updateDate = new Date(lastUpdate.date).toLocaleDateString('ru-RU');
      oneRMInfo.createEl('span', { text: ` (обновлено ${updateDate})`, cls: 'exercise-one-rm-date' });
    }
  }

  /**
   * Показывает форму добавления нового упражнения
   */
  private showAddExerciseForm() {
    const modal = this.createExerciseModal();
    const form = modal.createDiv({ cls: 'exercise-form' });

    form.createEl('h4', { text: 'Добавить новое упражнение' });

    const nameInput = form.createEl('input', {
      type: 'text',
      placeholder: 'Название упражнения',
      cls: 'exercise-input'
    });

    const categoryInput = form.createEl('input', {
      type: 'text',
      placeholder: 'Категория (грудь, спина, ноги...)',
      cls: 'exercise-input'
    });

    const equipmentInput = form.createEl('input', {
      type: 'text',
      placeholder: 'Оборудование (штанга, гантели...)',
      cls: 'exercise-input'
    });

    const difficultySelect = form.createEl('select', { cls: 'exercise-input' });
    difficultySelect.createEl('option', { value: '', text: 'Выберите сложность...' });
    ['начинающий', 'средний', 'продвинутый'].forEach(level => {
      difficultySelect.createEl('option', { value: level, text: level });
    });

    const muscleGroupsInput = form.createEl('input', {
      type: 'text',
      placeholder: 'Мышечные группы (через запятую)',
      cls: 'exercise-input'
    });

    const descriptionInput = form.createEl('textarea', {
      placeholder: 'Описание техники выполнения...',
      cls: 'exercise-input exercise-textarea'
    });

    // No manual 1ПМ field: peak max is optional via history only

    // Кнопки
    const buttons = form.createDiv({ cls: 'exercise-form-buttons' });
    
    const saveBtn = buttons.createEl('button', {
      text: 'Сохранить',
      cls: 'exercise-btn exercise-btn-primary'
    });

    const cancelBtn = buttons.createEl('button', {
      text: 'Отмена',
      cls: 'exercise-btn'
    });

    // Обработчики
    saveBtn.addEventListener('click', async () => {
      if (!nameInput.value.trim()) {
        nameInput.focus();
        return;
      }

      const exercise: ExerciseSpec = {
        group: categoryInput.value.trim() || 'Общие', // Обязательное поле
        category: categoryInput.value.trim() || 'Общие',
        equipment: equipmentInput.value.trim(),
        difficulty: difficultySelect.value as any,
        description: descriptionInput.value.trim(),
        muscleGroups: muscleGroupsInput.value.split(',').map(g => g.trim()).filter(g => g),
        oneRMHistory: undefined
      };

      await this.addExercise(nameInput.value.trim(), exercise);
      this.hideModal(modal);
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal(modal);
    });
  }

  /**
   * Показывает форму редактирования упражнения
   */
  private showEditExerciseForm(name: string, exercise: ExerciseSpec) {
    const modal = this.createExerciseModal();
    const form = modal.createDiv({ cls: 'exercise-form' });

    form.createEl('h4', { text: `Редактировать: ${name}` });

    const categoryInput = form.createEl('input', {
      type: 'text',
      value: exercise.category || '',
      placeholder: 'Категория',
      cls: 'exercise-input'
    });

    const equipmentInput = form.createEl('input', {
      type: 'text',
      value: exercise.equipment || '',
      placeholder: 'Оборудование',
      cls: 'exercise-input'
    });

    const difficultySelect = form.createEl('select', { cls: 'exercise-input' });
    difficultySelect.createEl('option', { value: '', text: 'Выберите сложность...' });
    ['начинающий', 'средний', 'продвинутый'].forEach(level => {
      const option = difficultySelect.createEl('option', { value: level, text: level });
      if (exercise.difficulty === level) option.selected = true;
    });

    const muscleGroupsInput = form.createEl('input', {
      type: 'text',
      value: exercise.muscleGroups ? exercise.muscleGroups.join(', ') : '',
      placeholder: 'Мышечные группы (через запятую)',
      cls: 'exercise-input'
    });

    const descriptionInput = form.createEl('textarea', {
      value: exercise.description || '',
      placeholder: 'Описание техники выполнения...',
      cls: 'exercise-input exercise-textarea'
    });

    // Кнопки
    const buttons = form.createDiv({ cls: 'exercise-form-buttons' });
    
    const saveBtn = buttons.createEl('button', {
      text: 'Сохранить',
      cls: 'exercise-btn exercise-btn-primary'
    });

    const cancelBtn = buttons.createEl('button', {
      text: 'Отмена',
      cls: 'exercise-btn'
    });

    // Обработчики
    saveBtn.addEventListener('click', async () => {
      const updatedExercise: ExerciseSpec = {
        group: categoryInput.value.trim() || 'Общие', // Обязательное поле
        category: categoryInput.value.trim() || 'Общие',
        equipment: equipmentInput.value.trim(),
        difficulty: difficultySelect.value as any,
        description: descriptionInput.value.trim(),
        muscleGroups: muscleGroupsInput.value.split(',').map(g => g.trim()).filter(g => g)
      };

      await this.updateExercise(name, updatedExercise);
      this.hideModal(modal);
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal(modal);
    });
  }

  /**
   * Добавляет новое упражнение
   */
  private async addExercise(name: string, exercise: ExerciseSpec) {
    this.library.exercises[name] = exercise;
    await this.saveLibrary();
    this.renderLibraryView();
  }

  /**
   * Обновляет упражнение
   */
  private async updateExercise(name: string, exercise: ExerciseSpec) {
    this.library.exercises[name] = exercise;
    await this.saveLibrary();
    this.renderLibraryView();
  }

  /**
   * Удаляет упражнение
   */
  private async deleteExercise(name: string) {
    if (confirm(`Удалить упражнение "${name}"?`)) {
      delete this.library.exercises[name];
      await this.saveLibrary();
      this.renderLibraryView();
    }
  }

  /**
   * Сохраняет библиотеку
   */
  private async saveLibrary() {
    try {
      await this.plugin.dataManager.saveExerciseLibrary(this.library);
    } catch (error) {
      console.error('Error saving exercise library:', error);
    }
  }

  /**
   * Получает уникальные категории
   */
  private getUniqueCategories(): string[] {
    const categories = new Set<string>();
    Object.values(this.library.exercises).forEach(exercise => {
      if (exercise.category) {
        categories.add(exercise.category);
      }
    });
    return Array.from(categories).sort();
  }

  /**
   * Группирует упражнения по категориям
   */
  private groupExercisesByCategory(exercises: [string, ExerciseSpec][]): Record<string, [string, ExerciseSpec][]> {
    const grouped: Record<string, [string, ExerciseSpec][]> = {};
    
    exercises.forEach(([name, exercise]) => {
      const category = exercise.category || 'Без категории';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push([name, exercise]);
    });

    return grouped;
  }

  /**
   * Фильтрует упражнения
   */
  private filterExercises(container: HTMLElement, searchTerm: string, categoryFilter: string) {
    this.renderExercisesList(container, searchTerm, categoryFilter);
  }

  /**
   * Создает модальное окно
   */
  private createExerciseModal(): HTMLElement {
    return createFullscreenModal();
  }

  /**
   * Скрывает модальное окно
   */
  private hideModal(modal: HTMLElement) {
    hideFullscreenModal(modal);
  }
}