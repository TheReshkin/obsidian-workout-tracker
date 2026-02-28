import { WorkoutEntry } from '../../types';
import WorkoutTrackerPlugin from '../../main';
import { createFullscreenModal, hideModal } from '../../utils/dom-helpers';
import { getExerciseSuggestions, showSuggestions, getExerciseFromLibrary } from './exercise-suggestions';
import { showCreateExerciseForm } from './create-exercise-form';

/** Intensity helpers */
function calculateIntensity(weight: number, oneRM: number): number {
  if (!oneRM || oneRM === 0) return 0;
  return Math.round((weight / oneRM) * 100);
}

function calculateWeight(intensity: number, oneRM: number): number {
  if (!oneRM || oneRM === 0) return 0;
  return Math.round((intensity / 100) * oneRM * 100) / 100;
}

export interface ExerciseFormContext {
  plugin: WorkoutTrackerPlugin;
  sourcePath: string;
  updateWorkout: (date: string, workout: WorkoutEntry) => Promise<void>;
  showEditWorkoutForm: (date: string, workout: WorkoutEntry) => void;
}

/**
 * Показывает форму добавления/редактирования упражнения
 */
export function showExerciseForm(
  ctx: ExerciseFormContext,
  date: string,
  workout: WorkoutEntry,
  exerciseIndex: number,
  isNewWorkout: boolean = false,
  renderCallback?: () => void
) {
  const modal = createFullscreenModal();
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

  // Контейнер для предложений
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
        const suggestions = await getExerciseSuggestions(ctx.plugin, inputValue);
        showSuggestions(
          suggestions,
          suggestionsContainer,
          nameInput,
          oneRMInput,
          ctx.sourcePath,
          ctx.plugin,
          (name, rmInput) => showCreateExerciseForm(ctx.plugin, name, rmInput)
        );
      } else {
        suggestionsContainer.style.display = 'none';
      }
    }, 300);
  });

  // Скрываем предложения при клике вне (with cleanup via AbortController)
  const suggestionsAbort = new AbortController();
  document.addEventListener('click', (e) => {
    if (!nameInputContainer.contains(e.target as Node)) {
      suggestionsContainer.style.display = 'none';
    }
  }, { signal: suggestionsAbort.signal });

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
    if (searchTimeout) clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {
      const exerciseName = nameInput.value.trim();
      if (exerciseName && !oneRMInput.value) {
        const exerciseFromLibrary = await getExerciseFromLibrary(ctx.plugin, ctx.sourcePath, exerciseName);
        if (exerciseFromLibrary && exerciseFromLibrary.currentOneRM) {
          oneRMInput.value = exerciseFromLibrary.currentOneRM.toString();
        }
      }
    }, 1000);
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

      const intensityInput = setRow.createEl('input', {
        type: 'number',
        value: (set.intensity !== undefined && set.intensity !== null && set.intensity !== 0) ? set.intensity.toString() : '',
        placeholder: '%',
        cls: 'workout-input workout-input-small'
      });
      intensityInput.min = '0';
      intensityInput.max = '100';
      setRow.createEl('span', { text: '% от 1ПМ' });

      // Обработчики для автоматического расчета
      weightInput.addEventListener('input', () => {
        const weight = weightInput.valueAsNumber;
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
          setInputs.forEach((input, i) => {
            if (sets[i] && i !== index) {
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
      setInputs.forEach((input, index) => {
        if (sets[index]) {
          sets[index].reps = Number.isFinite(input.repsInput.valueAsNumber) ? input.repsInput.valueAsNumber : 0;
          sets[index].weight = Number.isFinite(input.weightInput.valueAsNumber) ? input.weightInput.valueAsNumber : 0;
          sets[index].intensity = Number.isFinite(input.intensityInput.valueAsNumber) ? input.intensityInput.valueAsNumber : 0;
        }
      });
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

    if (!workout.exercises) {
      workout.exercises = [];
    }

    if (isEditing) {
      workout.exercises[exerciseIndex] = exerciseData;
    } else {
      workout.exercises.push(exerciseData);
    }

    if (!isNewWorkout) {
      await ctx.updateWorkout(date, workout);
    }

    hideModal(modal);
    suggestionsAbort.abort();

    if (isNewWorkout && renderCallback) {
      renderCallback();
    } else if (!isNewWorkout) {
      ctx.showEditWorkoutForm(date, workout);
    }
  });

  cancelBtn.addEventListener('click', () => {
    suggestionsAbort.abort();
    hideModal(modal);
  });
}
