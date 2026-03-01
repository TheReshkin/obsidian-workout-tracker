import { MarkdownPostProcessorContext, TFile, Notice } from 'obsidian';
import { WorkoutData, WorkoutEntry, WorkoutStatus } from '../types';
import { statusToClass, statusToLabel } from '../utils/status-utils';
import { createFullscreenModal, hideModal as hideFullscreenModal } from '../utils/dom-helpers';
import { showExerciseForm, ExerciseFormContext } from './forms/exercise-form';
import WorkoutTrackerPlugin from '../main';

/**
 * Инлайн редактор для быстрого редактирования тренировок прямо в файле
 */
export class InlineWorkoutEditor {
  private plugin: WorkoutTrackerPlugin;
  private container: HTMLElement;
  private workoutData: WorkoutData;
  private context: MarkdownPostProcessorContext;
  private originalSource: string;

  constructor(
    plugin: WorkoutTrackerPlugin,
    container: HTMLElement,
    workoutData: WorkoutData,
    context: MarkdownPostProcessorContext,
    originalSource: string
  ) {
    this.plugin = plugin;
    this.container = container;
    this.workoutData = workoutData;
    this.context = context;
    this.originalSource = originalSource;
  }

  /**
   * Показывает форму для добавления новой тренировки
   */
  showAddWorkoutForm(date?: string, existingWorkout?: WorkoutEntry) {
    const modal = this.createInlineModal();
    const form = modal.createDiv({ cls: 'workout-inline-form' });

    form.createEl('h4', { text: 'Добавить тренировку' });

    // Дата
    const dateInput = form.createEl('input', {
      type: 'date',
      value: date || new Date().toISOString().split('T')[0],
      cls: 'workout-input'
    });

    // Тип тренировки
    const typeSelect = form.createEl('select', { cls: 'workout-input' });
    typeSelect.createEl('option', { value: '', text: 'Выберите тип...' });
    this.plugin.settings.customWorkoutTypes.forEach(type => {
      const option = typeSelect.createEl('option', { value: type, text: type });
      if (type === existingWorkout?.type) option.selected = true;
    });
    // mark empty selects for contrast
    const markEmpty = (el: HTMLSelectElement) => {
      if (!el.value) el.classList.add('is-empty'); else el.classList.remove('is-empty');
    };
    markEmpty(typeSelect as HTMLSelectElement);
    typeSelect.addEventListener('change', () => markEmpty(typeSelect as HTMLSelectElement));

    // Статус
    const statusSelect = form.createEl('select', { cls: 'workout-input' });
  statusSelect.createEl('option', { value: 'planned', text: 'Запланировано' });
    statusSelect.createEl('option', { value: 'done', text: 'Выполнено' });
    statusSelect.createEl('option', { value: 'skipped', text: 'Пропущено' });
    statusSelect.createEl('option', { value: 'illness', text: 'Болезнь' });
  statusSelect.value = existingWorkout?.status || 'planned';
  markEmpty(statusSelect as HTMLSelectElement);
  statusSelect.addEventListener('change', () => markEmpty(statusSelect as HTMLSelectElement));

    // apply status class to the select itself so the field is colorized
    {
      const initClass = statusToClass(statusSelect.value as WorkoutStatus);
      statusSelect.classList.add(initClass);
      statusSelect.setAttribute('title', statusToLabel(statusSelect.value as WorkoutStatus));
      statusSelect.addEventListener('change', () => {
        const s = statusSelect.value as WorkoutStatus;
        // remove previous status-* classes
        ['status-planned','status-done','status-skipped','status-illness'].forEach(c => statusSelect.classList.remove(c));
        statusSelect.classList.add(statusToClass(s));
        statusSelect.setAttribute('title', statusToLabel(s));
      });
    }

    // Заметки
    const notesInput = form.createEl('textarea', {
      value: existingWorkout?.notes || '',
      placeholder: 'Заметки о тренировке...',
      cls: 'workout-input workout-textarea'
    });

    // Упражнения
    const exercisesSection = form.createDiv({ cls: 'workout-exercises-section' });
    exercisesSection.createEl('h5', { text: 'Упражнения:' });
    
    const exercisesContainer = exercisesSection.createDiv({ cls: 'workout-exercises-container' });
    
    const tempWorkout: WorkoutEntry = existingWorkout || {
      status: 'planned',
      type: 'другое',
      exercises: []
    };
    
    const renderExercises = () => {
      exercisesContainer.empty();

      // visual drop indicator
      const dropIndicator = exercisesContainer.createDiv({ cls: 'workout-drop-indicator' });
      dropIndicator.style.display = 'none';
      dropIndicator.style.height = '6px';
      dropIndicator.style.margin = '6px 0';
      dropIndicator.style.borderRadius = '3px';
      dropIndicator.style.background = 'var(--interactive-accent)';

      if (tempWorkout.exercises && tempWorkout.exercises.length > 0) {
        tempWorkout.exercises.forEach((exercise, index) => {
          const exerciseEl = exercisesContainer.createDiv({ cls: 'workout-exercise-item' });

          // Numbering for clarity
          const exerciseInfo = exerciseEl.createDiv({ cls: 'workout-exercise-info' });
          exerciseInfo.textContent = `${index + 1}. ${exercise.name}: ${exercise.sets.length} подх.`;

          // per-exercise status indicator removed — using workout-level status badge instead

          // Make exercise draggable to reorder
          exerciseEl.draggable = true;
          exerciseEl.dataset.index = String(index);
          exerciseEl.classList.add('workout-exercise-draggable');

          exerciseEl.addEventListener('dragstart', (e) => {
            (e.dataTransfer as DataTransfer).setData('text/plain', String(index));
            exerciseEl.classList.add('workout-dragging');
          });

          exerciseEl.addEventListener('dragend', () => {
            exerciseEl.classList.remove('workout-dragging');
            dropIndicator.style.display = 'none';
          });

          exerciseEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            exerciseEl.classList.add('workout-drop-target');
            const rect = exerciseEl.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            // determine desired insertion point (before or after this element)
            const desiredBefore = ((e as DragEvent).clientY < mid) ? exerciseEl : exerciseEl.nextSibling;
            // only move indicator if it's not already at the desired position
            if (dropIndicator.nextSibling !== desiredBefore) {
              exercisesContainer.insertBefore(dropIndicator, desiredBefore);
            }
            if (dropIndicator.style.display !== 'block') dropIndicator.style.display = 'block';
          });

          exerciseEl.addEventListener('dragleave', () => {
            exerciseEl.classList.remove('workout-drop-target');
            // don't hide immediately here — let dragend/drop handle hiding to avoid flicker when moving between items
          });

          exerciseEl.addEventListener('drop', (e) => {
            e.preventDefault();
            exerciseEl.classList.remove('workout-drop-target');
            dropIndicator.style.display = 'none';
            const src = (e.dataTransfer as DataTransfer).getData('text/plain');
            const srcIndex = parseInt(src, 10);
            const children = Array.from(exercisesContainer.querySelectorAll('.workout-exercise-item')) as HTMLElement[];
            let destIndex = children.indexOf(exerciseEl);
            const rect = exerciseEl.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if ((e as DragEvent).clientY >= mid) destIndex = destIndex + 1;
            if (!isNaN(srcIndex) && !isNaN(destIndex) && srcIndex !== destIndex) {
              const item = tempWorkout.exercises!.splice(srcIndex, 1)[0];
              const adjustedIndex = srcIndex < destIndex ? destIndex - 1 : destIndex;
              tempWorkout.exercises!.splice(adjustedIndex, 0, item);
              renderExercises();
            }
          });
          
          const editBtn = exerciseEl.createEl('button', {
            text: 'Изменить',
            cls: 'workout-btn workout-btn-small'
          });
          
          const deleteBtn = exerciseEl.createEl('button', {
            text: 'Удалить',
            cls: 'workout-btn workout-btn-small workout-btn-danger'
          });
          
          editBtn.addEventListener('click', () => {
            this.showExerciseForm(dateInput.value, tempWorkout, index, true, renderExercises);
          });
          
          deleteBtn.addEventListener('click', () => {
            if (confirm(`Удалить упражнение "${exercise.name}"?`)) {
              tempWorkout.exercises!.splice(index, 1);
              renderExercises();
            }
          });
        });
      }
      
      // Кнопка добавления упражнения
      const addExerciseBtn = exercisesContainer.createEl('button', {
        text: 'Добавить упражнение',
        cls: 'workout-btn workout-btn-secondary'
      });
      
      addExerciseBtn.addEventListener('click', () => {
        this.showExerciseForm(dateInput.value, tempWorkout, -1, true, renderExercises);
      });
    };
    
    renderExercises();

    // Кнопки
    const buttons = form.createDiv({ cls: 'workout-form-buttons' });
    
    const saveBtn = buttons.createEl('button', {
      text: 'Сохранить',
      cls: 'workout-btn workout-btn-primary'
    });

    const cancelBtn = buttons.createEl('button', {
      text: 'Отмена',
      cls: 'workout-btn'
    });

    // Обработчики
    saveBtn.addEventListener('click', async () => {
      const workout: WorkoutEntry = {
        status: statusSelect.value as WorkoutStatus,
        type: typeSelect.value,
        notes: notesInput.value || undefined,
        exercises: tempWorkout.exercises && tempWorkout.exercises.length > 0 ? tempWorkout.exercises : undefined
      };

      await this.addWorkout(dateInput.value, workout);
      this.hideModal(modal);
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal(modal);
    });
  }

  /**
   * Показывает форму редактирования тренировки
   */
  showEditWorkoutForm(date: string, workout: WorkoutEntry) {
    const modal = this.createInlineModal();
    // mark modal as large so CSS increases width/height for easier editing
    try {
      const modalContainer = (modal as any).modalContainer || modal.closest('.workout-fullscreen-modal');
      modalContainer && modalContainer.classList && modalContainer.classList.add('workout-fullscreen-large');
    } catch (e) {
      // ignore if not available
    }
    const form = modal.createDiv({ cls: 'workout-inline-form' });

    form.createEl('h4', { text: `Редактировать тренировку ${date}` });

    // Тип тренировки
    const typeSelect = form.createEl('select', { cls: 'workout-input' });
    this.plugin.settings.customWorkoutTypes.forEach(type => {
      const option = typeSelect.createEl('option', { value: type, text: type });
      if (type === workout.type) option.selected = true;
    });

    // Статус
    const statusSelect = form.createEl('select', { cls: 'workout-input' });
    [
      { value: 'planned', text: 'Запланировано' },
      { value: 'done', text: 'Выполнено' },
      { value: 'skipped', text: 'Пропущено' },
      { value: 'illness', text: 'Болезнь' }
    ].forEach(status => {
      const option = statusSelect.createEl('option', { value: status.value, text: status.text });
      if (status.value === workout.status) option.selected = true;
    });
    // mark empty selects for contrast
    const markEmptyEdit = (el: HTMLSelectElement) => {
      if (!el.value) el.classList.add('is-empty'); else el.classList.remove('is-empty');
    };
    markEmptyEdit(typeSelect as HTMLSelectElement);
    markEmptyEdit(statusSelect as HTMLSelectElement);
    typeSelect.addEventListener('change', () => markEmptyEdit(typeSelect as HTMLSelectElement));
    statusSelect.addEventListener('change', () => markEmptyEdit(statusSelect as HTMLSelectElement));

    // apply status class to the select itself so the field is colorized
    {
      const initClass = statusToClass(statusSelect.value as WorkoutStatus);
      statusSelect.classList.add(initClass);
      statusSelect.setAttribute('title', statusToLabel(statusSelect.value as WorkoutStatus));
      statusSelect.addEventListener('change', () => {
        const s = statusSelect.value as WorkoutStatus;
        ['status-planned','status-done','status-skipped','status-illness'].forEach(c => statusSelect.classList.remove(c));
        statusSelect.classList.add(statusToClass(s));
        statusSelect.setAttribute('title', statusToLabel(s));
      });
    }

    // Заметки
    const notesInput = form.createEl('textarea', {
      value: workout.notes || '',
      placeholder: 'Заметки о тренировке...',
      cls: 'workout-input workout-textarea'
    });

    // Упражнения
    const exercisesSection = form.createDiv({ cls: 'workout-exercises-section' });
    exercisesSection.createEl('h5', { text: 'Упражнения:' });
    
    const exercisesContainer = exercisesSection.createDiv({ cls: 'workout-exercises-container' });
    
    // Render exercises into the container and support in-memory edits (batch save)
    const renderExercises = () => {
      exercisesContainer.empty();

      // drop indicator
      const dropIndicator = exercisesContainer.createDiv({ cls: 'workout-drop-indicator' });
      dropIndicator.style.display = 'none';
      dropIndicator.style.height = '6px';
      dropIndicator.style.margin = '6px 0';
      dropIndicator.style.borderRadius = '3px';
      dropIndicator.style.background = 'var(--interactive-accent)';

      if (workout.exercises && workout.exercises.length > 0) {
        workout.exercises.forEach((exercise, index) => {
          const exerciseEl = exercisesContainer.createDiv({ cls: 'workout-exercise-item' });

          const exerciseInfo = exerciseEl.createDiv({ cls: 'workout-exercise-info' });
          exerciseInfo.textContent = `${index + 1}. ${exercise.name}: ${exercise.sets.length} подх.`;

          const editBtn = exerciseEl.createEl('button', {
            text: 'Изменить',
            cls: 'workout-btn workout-btn-small'
          });

          const deleteBtn = exerciseEl.createEl('button', {
            text: 'Удалить',
            cls: 'workout-btn workout-btn-small workout-btn-danger'
          });

          editBtn.addEventListener('click', () => {
            // Open exercise editor but don't persist to file yet; re-render after save
            this.showExerciseForm(date, workout, index, true, renderExercises);
          });

          deleteBtn.addEventListener('click', () => {
            if (confirm(`Удалить упражнение "${exercise.name}"?`)) {
              workout.exercises!.splice(index, 1);
              renderExercises();
            }
          });

          // Make exercise draggable to reorder
          exerciseEl.draggable = true;
          exerciseEl.dataset.index = String(index);
          exerciseEl.classList.add('workout-exercise-draggable');

          exerciseEl.addEventListener('dragstart', (e) => {
            (e.dataTransfer as DataTransfer).setData('text/plain', String(index));
            exerciseEl.classList.add('workout-dragging');
          });

          exerciseEl.addEventListener('dragend', () => {
            exerciseEl.classList.remove('workout-dragging');
            dropIndicator.style.display = 'none';
          });

          exerciseEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            exerciseEl.classList.add('workout-drop-target');
            const rect = exerciseEl.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const desiredBefore = ((e as DragEvent).clientY < mid) ? exerciseEl : exerciseEl.nextSibling;
            if (dropIndicator.nextSibling !== desiredBefore) {
              exercisesContainer.insertBefore(dropIndicator, desiredBefore);
            }
            if (dropIndicator.style.display !== 'block') dropIndicator.style.display = 'block';
          });

          exerciseEl.addEventListener('dragleave', () => {
            exerciseEl.classList.remove('workout-drop-target');
          });

          exerciseEl.addEventListener('drop', (e) => {
            e.preventDefault();
            exerciseEl.classList.remove('workout-drop-target');
            dropIndicator.style.display = 'none';
            const src = (e.dataTransfer as DataTransfer).getData('text/plain');
            const srcIndex = parseInt(src, 10);
            const children = Array.from(exercisesContainer.querySelectorAll('.workout-exercise-item')) as HTMLElement[];
            let destIndex = children.indexOf(exerciseEl);
            const rect = exerciseEl.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if ((e as DragEvent).clientY >= mid) destIndex = destIndex + 1;
            if (!isNaN(srcIndex) && !isNaN(destIndex) && srcIndex !== destIndex) {
              const item = workout.exercises!.splice(srcIndex, 1)[0];
              const adjustedIndex = srcIndex < destIndex ? destIndex - 1 : destIndex;
              workout.exercises!.splice(adjustedIndex, 0, item);
              // re-render in-memory order
              renderExercises();
            }
          });
        });
      }

      // Кнопка добавления упражнения (operates in-memory; Save persists whole workout)
      const addExerciseBtn = exercisesContainer.createEl('button', {
        text: 'Добавить упражнение',
        cls: 'workout-btn workout-btn-secondary'
      });

      addExerciseBtn.addEventListener('click', () => {
        this.showExerciseForm(date, workout, -1, true, renderExercises);
      });
    };

    // initial render
    renderExercises();

    // Кнопки
    const buttons = form.createDiv({ cls: 'workout-form-buttons' });
    
    const saveBtn = buttons.createEl('button', {
      text: 'Сохранить',
      cls: 'workout-btn workout-btn-primary'
    });

    const deleteBtn = buttons.createEl('button', {
      text: 'Удалить',
      cls: 'workout-btn workout-btn-danger'
    });

    const cancelBtn = buttons.createEl('button', {
      text: 'Отмена',
      cls: 'workout-btn'
    });

    // Обработчики
    saveBtn.addEventListener('click', async () => {
      const updatedWorkout: WorkoutEntry = {
        ...workout,
        status: statusSelect.value as WorkoutStatus,
        type: typeSelect.value,
        notes: notesInput.value || undefined
      };

      await this.updateWorkout(date, updatedWorkout);
      this.hideModal(modal);
    });

    deleteBtn.addEventListener('click', async () => {
      if (confirm('Удалить эту тренировку?')) {
        await this.deleteWorkout(date);
        this.hideModal(modal);
      }
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal(modal);
    });
  }

  /**
   * Добавляет новую тренировку
   */
  private async addWorkout(date: string, workout: WorkoutEntry) {
    this.workoutData[date] = workout;
    await this.saveDataToFile();
  }

  /**
   * Обновляет существующую тренировку
   */
  private async updateWorkout(date: string, workout: WorkoutEntry) {
    this.workoutData[date] = workout;
    await this.saveDataToFile();
  }

  /**
   * Удаляет тренировку
   */
  private async deleteWorkout(date: string) {
    delete this.workoutData[date];
    await this.saveDataToFile();
  }

  /**
   * Показывает однодневный вид для удобного просмотра и редактирования всех упражнений дня
   */
  async showSingleDayView(date: string) {
    const modal = this.createInlineModal();
    try {
      const modalContainer = (modal as any).modalContainer || modal.closest('.workout-fullscreen-modal');
      modalContainer && modalContainer.classList && modalContainer.classList.add('workout-fullscreen-large');
    } catch (e) {}

    const form = modal.createDiv({ cls: 'single-day-view' });
    form.createEl('h3', { text: `Тренировка: ${date}` });

    const workout = this.workoutData[date];
    if (!workout) {
      form.createDiv({ text: 'Тренировка не найдена', cls: 'workout-placeholder' });
      return;
    }

    // Header actions
    const headerActions = form.createDiv({ cls: 'single-day-actions' });
    const backBtn = headerActions.createEl('button', { text: 'Закрыть', cls: 'workout-btn' });
    backBtn.addEventListener('click', () => this.hideModal(modal));

    const exercisesContainer = form.createDiv({ cls: 'single-day-exercises' });
    if (workout.exercises && workout.exercises.length > 0) {
      workout.exercises.forEach((exercise, idx) => {
        const item = exercisesContainer.createDiv({ cls: 'single-day-exercise-item' });
        item.createDiv({ text: `${idx + 1}. ${exercise.name}`, cls: 'exercise-name' });
        if (exercise.sets && exercise.sets.length > 0) {
          const setsSummary = item.createDiv({ cls: 'exercise-sets' });
          setsSummary.textContent = `${exercise.sets.length} подх., ${exercise.sets.reduce((acc, s) => acc + (s.reps || 0), 0)} повт.`;
        }
        // Estimate 1RM from sets if available
        if (exercise.sets && exercise.sets.length > 0) {
          let best = 0;
          exercise.sets.forEach(s => {
            if (s.weight && s.weight > 0 && s.reps && s.reps > 0) {
              const est = s.weight * (1 + (s.reps / 30));
              if (est > best) best = est;
            }
          });
          if (best > 0) {
            const oneRm = item.createDiv({ cls: 'exercise-one-rm-info' });
            oneRm.textContent = `1ПМ: ${Math.round(best)} кг`;
          }
        }

        const actions = item.createDiv({ cls: 'single-day-item-actions' });
        const editBtn = actions.createEl('button', { text: 'Изменить', cls: 'workout-btn workout-btn-small' });
        editBtn.addEventListener('click', () => {
          this.hideModal(modal);
          // open edit form for this exercise
          this.showExerciseForm(date, workout, idx);
        });
      });
    } else {
      exercisesContainer.createDiv({ text: 'Упражнений нет', cls: 'workout-placeholder' });
    }
  }

  /**
   * Сохраняет данные обратно в файл
   */
  private async saveDataToFile() {
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(this.context.sourcePath);
      if (!(file instanceof TFile)) return;

      const content = await this.plugin.app.vault.read(file);
      const newJsonData = JSON.stringify(this.workoutData, null, 2);
      
      // Заменяем JSON блок в файле
      const newContent = content.replace(
        /```workout\s*\n[\s\S]*?\n```/,
        `\`\`\`workout\n${newJsonData}\n\`\`\``
      );

      await this.plugin.app.vault.modify(file, newContent);
      
    } catch (error) {
      console.error('Error saving workout data:', error);
    }
  }

  /**
   * Показывает форму добавления/редактирования упражнения
   */
  showExerciseForm(date: string, workout: WorkoutEntry, exerciseIndex: number, isNewWorkout: boolean = false, renderCallback?: () => void) {
    const ctx: ExerciseFormContext = {
      plugin: this.plugin,
      sourcePath: this.context.sourcePath,
      updateWorkout: (d, w) => this.updateWorkout(d, w),
      showEditWorkoutForm: (d, w) => this.showEditWorkoutForm(d, w),
    };
    showExerciseForm(ctx, date, workout, exerciseIndex, isNewWorkout, renderCallback);
  }

  /**
   * Создает полноэкранное модальное окно
   */
  private createInlineModal(): HTMLElement {
    return createFullscreenModal();
  }

  /**
   * Скрывает модальное окно
   */
  private hideModal(modal: HTMLElement) {
    hideFullscreenModal(modal);
  }

  /**
   * Обновляет данные тренировок и перезагружает отображение
   */
  updateWorkoutData(newData: WorkoutData) {
    this.workoutData = newData;
    this.saveDataToFile();
  }
}