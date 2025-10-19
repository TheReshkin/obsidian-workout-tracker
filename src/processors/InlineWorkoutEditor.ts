import { MarkdownPostProcessorContext, TFile, Notice } from 'obsidian';
import { WorkoutData, WorkoutEntry, WorkoutStatus, ExerciseSpec } from '../types';
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
    try {
      const { statusToClass, statusToLabel } = require('../utils/status-utils');
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
    } catch (e) {
      // ignore if helper not available
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
    try {
      const { statusToClass, statusToLabel } = require('../utils/status-utils');
      const initClass = statusToClass(statusSelect.value as WorkoutStatus);
      statusSelect.classList.add(initClass);
      statusSelect.setAttribute('title', statusToLabel(statusSelect.value as WorkoutStatus));
      statusSelect.addEventListener('change', () => {
        const s = statusSelect.value as WorkoutStatus;
        ['status-planned','status-done','status-skipped','status-illness'].forEach(c => statusSelect.classList.remove(c));
        statusSelect.classList.add(statusToClass(s));
        statusSelect.setAttribute('title', statusToLabel(s));
      });
    } catch (e) {
      // ignore
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
    
    // Показать существующие упражнения
    if (workout.exercises && workout.exercises.length > 0) {
      // drop indicator
      const dropIndicator = exercisesContainer.createDiv({ cls: 'workout-drop-indicator' });
      dropIndicator.style.display = 'none';
      dropIndicator.style.height = '6px';
      dropIndicator.style.margin = '6px 0';
      dropIndicator.style.borderRadius = '3px';
      dropIndicator.style.background = 'var(--interactive-accent)';

      workout.exercises.forEach((exercise, index) => {
        const exerciseEl = exercisesContainer.createDiv({ cls: 'workout-exercise-item' });

        const exerciseInfo = exerciseEl.createDiv({ cls: 'workout-exercise-info' });
        exerciseInfo.textContent = `${index + 1}. ${exercise.name}: ${exercise.sets.length} подх.`;

        // per-exercise status indicator removed — prefer workout-level status badge

        const editBtn = exerciseEl.createEl('button', {
          text: 'Изменить',
          cls: 'workout-btn workout-btn-small'
        });

        const deleteBtn = exerciseEl.createEl('button', {
          text: 'Удалить',
          cls: 'workout-btn workout-btn-small workout-btn-danger'
        });

        editBtn.addEventListener('click', () => {
          this.showExerciseForm(date, workout, index);
        });

        deleteBtn.addEventListener('click', () => {
          if (confirm(`Удалить упражнение "${exercise.name}"?`)) {
            workout.exercises!.splice(index, 1);
            this.updateWorkout(date, workout);
            this.hideModal(modal);
            this.showEditWorkoutForm(date, workout);
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
          // do not hide immediately to reduce flicker
        });

        exerciseEl.addEventListener('drop', async (e) => {
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
            // Save new order and re-open editor to reflect changes
            await this.updateWorkout(date, workout);
            this.hideModal(modal);
            this.showEditWorkoutForm(date, workout);
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
      this.showExerciseForm(date, workout, -1);
    });

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
   * Получает данные упражнения из библиотеки
   */
  private async getExerciseFromLibrary(exerciseName: string): Promise<ExerciseSpec | null> {
    try {
      // Пытаемся найти файл с библиотекой упражнений в том же каталоге
      const currentFilePath = this.context.sourcePath;
      const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
      
      // Ищем файлы с блоком exercises в текущей папке
      const files = this.plugin.app.vault.getMarkdownFiles();
      for (const file of files) {
        if (file.path.startsWith(currentDir)) {
          const content = await this.plugin.app.vault.read(file);
          const exerciseMatch = content.match(/```exercises\s*\n([\s\S]*?)\n```/);
          
          if (exerciseMatch) {
            try {
              const exerciseData = JSON.parse(exerciseMatch[1]);
              if (exerciseData[exerciseName]) {
                return exerciseData[exerciseName];
              }
            } catch (e) {
              console.warn('Failed to parse exercise data from', file.path);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting exercise from library:', error);
    }
    return null;
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
    const modal = this.createInlineModal();
    const form = modal.createDiv({ cls: 'workout-inline-form workout-exercise-form' });

    const isEditing = exerciseIndex >= 0;
    const exercise = isEditing ? workout.exercises![exerciseIndex] : null;

    form.createEl('h4', { 
      text: isEditing ? 'Редактировать упражнение' : 'Добавить упражнение' 
    });

    // Название упражнения
    form.createEl('label', { text: 'Название упражнения:' });
    const nameInputContainer = form.createDiv({ cls: 'workout-input-container' });
    const nameInput = nameInputContainer.createEl('input', {
      type: 'text',
      value: exercise?.name || '',
      placeholder: 'Название упражнения',
      cls: 'workout-input'
    });
    
    // Создаем контейнер для предложений
    const suggestionsContainer = nameInputContainer.createDiv({ 
      cls: 'workout-suggestions-container' 
    });
    suggestionsContainer.style.display = 'none';

    // Автодополнение для названий упражнений
    let suggestionsTimeout: NodeJS.Timeout;
    nameInput.addEventListener('input', () => {
      clearTimeout(suggestionsTimeout);
      
      suggestionsTimeout = setTimeout(async () => {
        const inputValue = nameInput.value.trim().toLowerCase();
        if (inputValue.length >= 2) {
          const suggestions = await this.getExerciseSuggestions(inputValue);
          this.showSuggestions(suggestions, suggestionsContainer, nameInput, oneRMInput);
        } else {
          suggestionsContainer.style.display = 'none';
        }
      }, 300);
    });

    // Скрываем предложения при клике вне
    document.addEventListener('click', (e) => {
      if (!nameInputContainer.contains(e.target as Node)) {
        suggestionsContainer.style.display = 'none';
      }
    });

    // Текущий 1ПМ для упражнения
    form.createEl('label', { text: 'Текущий 1ПМ (пиковый максимум):' });
    const oneRMInput = form.createEl('input', {
      type: 'number',
      value: (exercise?.currentOneRM || '').toString(),
      placeholder: 'Введите текущий 1ПМ в кг',
      cls: 'workout-input'
    });

    // Автоматическое подставление 1ПМ из библиотеки при вводе названия
    let searchTimeout: NodeJS.Timeout;
    nameInput.addEventListener('input', () => {
      // Очищаем предыдущий таймер
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      
      // Устанавливаем новый таймер с задержкой
      searchTimeout = setTimeout(async () => {
        const exerciseName = nameInput.value.trim();
        if (exerciseName && !oneRMInput.value) {
          const exerciseFromLibrary = await this.getExerciseFromLibrary(exerciseName);
          if (exerciseFromLibrary && exerciseFromLibrary.currentOneRM) {
            oneRMInput.value = exerciseFromLibrary.currentOneRM.toString();
          }
        }
      }, 1000); // Подставляем 1ПМ через секунду после окончания ввода
    });

    // Подходы
    form.createEl('label', { text: 'Подходы:' });
    const setsContainer = form.createDiv({ cls: 'workout-sets-container' });
    
    const sets = exercise?.sets || [{ reps: 0, weight: 0, intensity: 0 }];
    const setInputs: { 
      repsInput: HTMLInputElement; 
      weightInput: HTMLInputElement;
      intensityInput: HTMLInputElement;
    }[] = [];

    const calculateIntensity = (weight: number, oneRM: number): number => {
      if (!oneRM || oneRM === 0) return 0;
      return Math.round((weight / oneRM) * 100);
    };

    const calculateWeight = (intensity: number, oneRM: number): number => {
      if (!oneRM || oneRM === 0) return 0;
      return Math.round((intensity / 100) * oneRM * 100) / 100; // округляем до 2 знаков
    };

    const renderSets = () => {
      setsContainer.empty();
      setInputs.length = 0;

      sets.forEach((set, index) => {
        const setRow = setsContainer.createDiv({ cls: 'workout-set-row' });

        setRow.createEl('span', { text: `Подход ${index + 1}:` });

        const repsInput = setRow.createEl('input', {
          type: 'number',
          value: (set.reps !== undefined && set.reps !== null && set.reps !== 0) ? set.reps.toString() : '',
          placeholder: 'Повторы',
          cls: 'workout-input workout-input-small'
        });

        setRow.createEl('span', { text: 'раз' });

        const weightInput = setRow.createEl('input', {
          type: 'number',
          value: (set.weight !== undefined && set.weight !== null && set.weight !== 0) ? set.weight.toString() : '',
          placeholder: 'Вес',
          cls: 'workout-input workout-input-small'
        });

        setRow.createEl('span', { text: 'кг' });

        // Поле интенсивности
        const intensityInput = setRow.createEl('input', {
          type: 'number',
          value: (set.intensity !== undefined && set.intensity !== null && set.intensity !== 0) ? set.intensity.toString() : '',
          placeholder: '%',
          cls: 'workout-input workout-input-small'
        });
        intensityInput.min = '0';
        intensityInput.max = '100';

        setRow.createEl('span', { text: '% от 1ПМ' });

        // Обработчики для автоматического расчета — только при валидных числах
        weightInput.addEventListener('input', () => {
          const weight = weightInput.valueAsNumber; // NaN если пусто/нечисло
          const oneRM = oneRMInput.valueAsNumber;
          if (Number.isFinite(oneRM) && Number.isFinite(weight)) {
            const intensity = calculateIntensity(weight, oneRM);
            intensityInput.value = intensity.toString();
            set.intensity = intensity;
          }
        });

        intensityInput.addEventListener('input', () => {
          const intensity = intensityInput.valueAsNumber;
          const oneRM = oneRMInput.valueAsNumber;
          if (Number.isFinite(oneRM) && Number.isFinite(intensity) && intensity >= 0 && intensity <= 100) {
            const weight = calculateWeight(intensity, oneRM);
            weightInput.value = weight.toString();
            set.weight = weight;
          }
        });

        oneRMInput.addEventListener('input', () => {
          // Пересчитать все интенсивности при изменении 1ПМ, только если 1ПМ валиден
          const oneRMVal = oneRMInput.valueAsNumber;
          if (!Number.isFinite(oneRMVal) || oneRMVal <= 0) return;

          sets.forEach((s, i) => {
            if (s.weight && s.weight > 0) {
              const intensity = calculateIntensity(s.weight, oneRMVal);
              if (setInputs[i]?.intensityInput) {
                setInputs[i].intensityInput.value = intensity.toString();
              }
              s.intensity = intensity;
            }
          });
        });

        if (sets.length > 1) {
          const deleteSetBtn = setRow.createEl('button', {
            text: '✕',
            cls: 'workout-btn workout-btn-small workout-btn-danger'
          });

          deleteSetBtn.addEventListener('click', () => {
            // Сохраняем текущие значения перед удалением (преобразуем пустые в 0)
            setInputs.forEach((input, i) => {
              if (sets[i] && i !== index) { // не сохраняем удаляемый подход
                sets[i].reps = Number.isFinite(input.repsInput.valueAsNumber) ? input.repsInput.valueAsNumber : 0;
                sets[i].weight = Number.isFinite(input.weightInput.valueAsNumber) ? input.weightInput.valueAsNumber : 0;
                sets[i].intensity = Number.isFinite(input.intensityInput.valueAsNumber) ? input.intensityInput.valueAsNumber : 0;
              }
            });

            sets.splice(index, 1);
            renderSets();
          });
        }

        setInputs.push({ repsInput, weightInput, intensityInput });
      });

      // Кнопка добавления подхода
      const addSetBtn = setsContainer.createEl('button', {
        text: 'Добавить подход',
        cls: 'workout-btn workout-btn-secondary'
      });

      addSetBtn.addEventListener('click', () => {
        // Сохраняем текущие значения перед добавлением нового подхода
        setInputs.forEach((input, index) => {
          if (sets[index]) {
            sets[index].reps = Number.isFinite(input.repsInput.valueAsNumber) ? input.repsInput.valueAsNumber : 0;
            sets[index].weight = Number.isFinite(input.weightInput.valueAsNumber) ? input.weightInput.valueAsNumber : 0;
            sets[index].intensity = Number.isFinite(input.intensityInput.valueAsNumber) ? input.intensityInput.valueAsNumber : 0;
          }
        });

        // Добавляем новый подход с пустыми значениями
        sets.push({ reps: 0, weight: 0, intensity: 0 });
        renderSets();
      });
    };

    renderSets();

    // Заметки к упражнению
    form.createEl('label', { text: 'Заметки:' });
    const notesInput = form.createEl('textarea', {
      value: exercise?.notes || '',
      placeholder: 'Заметки к упражнению...',
      cls: 'workout-input workout-textarea-small'
    });

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
      const name = nameInput.value.trim();
      if (!name) {
        alert('Введите название упражнения');
        return;
      }

      // Собираем данные подходов
      const exerciseSets = setInputs.map(({ repsInput, weightInput, intensityInput }) => ({
        reps: parseInt(repsInput.value) || 0,
        weight: parseFloat(weightInput.value) || 0,
        intensity: parseFloat(intensityInput.value) || 0
      }));

      const currentOneRM = parseFloat(oneRMInput.value) || undefined;

      const exerciseData = {
        name,
        sets: exerciseSets,
        notes: notesInput.value.trim() || undefined,
        currentOneRM
      };

      // Инициализируем массив упражнений если его нет
      if (!workout.exercises) {
        workout.exercises = [];
      }

      if (isEditing) {
        workout.exercises[exerciseIndex] = exerciseData;
      } else {
        workout.exercises.push(exerciseData);
      }

      // Если это новая тренировка (временный объект), то не сохраняем в файл
      if (!isNewWorkout) {
        await this.updateWorkout(date, workout);
      }
      
      this.hideModal(modal);
      
      // Если это новая тренировка (временный объект), то вызываем callback для обновления
      if (isNewWorkout && renderCallback) {
        renderCallback();
      } else if (!isNewWorkout) {
        this.showEditWorkoutForm(date, workout);
      }
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal(modal);
    });
  }

  /**
   * Создает полноэкранное модальное окно
   */
  private createInlineModal(): HTMLElement {
    // Создаем модальное окно на уровне документа, а не внутри контейнера
    const modal = document.body.createDiv({ cls: 'workout-fullscreen-modal' });
    
    // Фон для закрытия
    const backdrop = modal.createDiv({ cls: 'workout-modal-backdrop' });
    backdrop.addEventListener('click', () => {
      this.hideModal(modal);
    });

    // Содержимое модала
    const content = modal.createDiv({ cls: 'workout-modal-content' });
    
    // Закрытие по ESC
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hideModal(modal);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Сохраняем ссылку на modal в content для правильного удаления
    (content as any).modalContainer = modal;
    
    return content;
  }

  /**
   * Получает предложения для автодополнения упражнений
   */
  private async getExerciseSuggestions(input: string): Promise<string[]> {
    try {
      // Получаем упражнения из библиотеки
      const libraryData = await this.plugin.dataManager.getExerciseLibrary();
      const libraryExercises = Object.keys(libraryData.exercises || {});
      
      // Получаем упражнения из тренировок
      const workoutData = await this.plugin.dataManager.getWorkoutData();
      const workoutExercises = new Set<string>();
      
      Object.values(workoutData).forEach(workout => {
        if (workout.exercises) {
          workout.exercises.forEach(exercise => {
            workoutExercises.add(exercise.name);
          });
        }
      });
      
      // Объединяем и фильтруем
      const allExercises = [...new Set([...libraryExercises, ...workoutExercises])];
      const filtered = allExercises
        .filter(name => name.toLowerCase().includes(input))
        .sort()
        .slice(0, 8); // Показываем максимум 8 предложений
        
      return filtered;
    } catch (error) {
      console.error('Ошибка при получении предложений упражнений:', error);
      return [];
    }
  }

  /**
   * Показывает предложения для автодополнения
   */
  private showSuggestions(
    suggestions: string[], 
    container: HTMLElement, 
    nameInput: HTMLInputElement,
    oneRMInput: HTMLInputElement
  ) {
    container.empty();
    
    const inputValue = nameInput.value.trim();
    
    // Всегда показываем контейнер если есть ввод
    if (inputValue.length >= 2) {
      // Показываем существующие предложения
      suggestions.forEach(suggestion => {
        const suggestionEl = container.createDiv({
          text: suggestion,
          cls: 'workout-suggestion-item'
        });
        
        suggestionEl.addEventListener('click', async () => {
          nameInput.value = suggestion;
          container.style.display = 'none';
          
          // Пытаемся подставить 1ПМ для выбранного упражнения
          if (!oneRMInput.value) {
            const exerciseFromLibrary = await this.getExerciseFromLibrary(suggestion);
            if (exerciseFromLibrary && exerciseFromLibrary.currentOneRM) {
              oneRMInput.value = exerciseFromLibrary.currentOneRM.toString();
            }
          }
        });
      });

      // Проверяем, есть ли точное совпадение
      const exactMatch = suggestions.some(s => s.toLowerCase() === inputValue.toLowerCase());
      
      // Если нет точного совпадения, добавляем опцию создания нового упражнения
      if (!exactMatch && inputValue.length >= 3) {
        const createNewEl = container.createDiv({
          cls: 'workout-suggestion-item workout-suggestion-create'
        });
        createNewEl.innerHTML = `
          <span class="create-icon">+</span>
          <span class="create-text">Создать "${inputValue}"</span>
        `;
        
        createNewEl.addEventListener('click', async () => {
          nameInput.value = inputValue;
          container.style.display = 'none';
          
          // Показываем форму создания нового упражнения
          await this.showCreateExerciseForm(inputValue, oneRMInput);
        });
      }
      
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }

  /**
   * Показывает форму создания нового упражнения
   */
  private async showCreateExerciseForm(exerciseName: string, oneRMInput: HTMLInputElement) {
    const modal = this.createInlineModal();
    const form = modal.createDiv({ cls: 'workout-inline-form' });

    form.createEl('h4', { text: 'Создать новое упражнение' });

    // Название (заполнено)
    form.createEl('label', { text: 'Название упражнения:' });
    const nameInput = form.createEl('input', {
      type: 'text',
      value: exerciseName,
      cls: 'workout-input'
    });
    nameInput.disabled = true; // Заблокировано, так как уже введено

    // Группа мышц
    form.createEl('label', { text: 'Группа мышц:' });
    const groupSelect = form.createEl('select', { cls: 'workout-input' });
    groupSelect.createEl('option', { value: '', text: 'Выберите группу...' });
    ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс', 'Кардио', 'Другое'].forEach(group => {
      groupSelect.createEl('option', { value: group, text: group });
    });

    // Описание
    form.createEl('label', { text: 'Описание (необязательно):' });
    const descInput = form.createEl('textarea', {
      placeholder: 'Краткое описание упражнения...',
      cls: 'workout-input workout-textarea'
    });

    // 1ПМ
    form.createEl('label', { text: 'Текущий 1ПМ (необязательно):' });
    const currentOneRMInput = form.createEl('input', {
      type: 'number',
      placeholder: 'Вес в кг',
      cls: 'workout-input'
    });

    // Кнопки
    const buttons = form.createDiv({ cls: 'workout-form-buttons' });
    
    const saveBtn = buttons.createEl('button', {
      text: 'Создать упражнение',
      cls: 'workout-btn workout-btn-primary'
    });

    const cancelBtn = buttons.createEl('button', {
      text: 'Отмена',
      cls: 'workout-btn'
    });

    // Обработчики
    saveBtn.addEventListener('click', async () => {
      // Валидация
      if (!groupSelect.value) {
        new Notice('Выберите группу мышц');
        return;
      }
      
      const exerciseSpec = {
        group: groupSelect.value,
        description: descInput.value.trim() || undefined,
        currentOneRM: parseFloat(currentOneRMInput.value) || undefined,
        muscleGroups: [groupSelect.value],
        difficulty: 'начинающий' as const
      };

      try {
        await this.plugin.dataManager.addExercise(exerciseName, exerciseSpec);
        
        // Перезагружаем библиотеку упражнений
        await this.plugin.dataManager.loadExerciseLibrary();
        
        // Обновляем поле 1ПМ в основной форме
        if (exerciseSpec.currentOneRM && !oneRMInput.value) {
          oneRMInput.value = exerciseSpec.currentOneRM.toString();
        }
        
        this.hideModal(modal);
        
        // Показываем уведомление об успехе
        new Notice(`Упражнение "${exerciseName}" добавлено в библиотеку`);
      } catch (error) {
        console.error('Ошибка при создании упражнения:', error);
        new Notice('Ошибка при создании упражнения');
      }
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal(modal);
    });
  }

  /**
   * Скрывает модальное окно
   */
  private hideModal(modal: HTMLElement) {
    // Если передан content, получаем ссылку на modal контейнер
    const modalContainer = (modal as any).modalContainer || modal.closest('.workout-fullscreen-modal') || modal;
    modalContainer.remove();
  }

  /**
   * Обновляет данные тренировок и перезагружает отображение
   */
  updateWorkoutData(newData: WorkoutData) {
    this.workoutData = newData;
    this.saveDataToFile();
  }
}