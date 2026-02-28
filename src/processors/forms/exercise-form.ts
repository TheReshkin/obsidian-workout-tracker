import { WorkoutEntry, WorkoutSet } from '../../types';
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

/** Default coarse weight steps (10 kg) */
const COARSE_WEIGHTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

/** Generate fine weight steps (2.5 kg) around a chosen centre */
function fineWeights(centre: number): number[] {
  const result: number[] = [];
  const start = Math.max(0, centre - 10);
  const end = centre + 12.5;
  for (let w = start; w <= end; w += 2.5) {
    result.push(Math.round(w * 10) / 10);
  }
  return result;
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

  // Подходы — dropdown для количества
  form.createEl('label', { text: 'Количество подходов:' });
  const setsCountSelect = form.createEl('select', { cls: 'workout-input workout-sets-dropdown' });
  for (let i = 1; i <= 10; i++) {
    setsCountSelect.createEl('option', { value: String(i), text: `${i} подход${i === 1 ? '' : i < 5 ? 'а' : 'ов'}` });
  }

  const sets: WorkoutSet[] = exercise?.sets?.length
    ? exercise.sets.map(s => ({ ...s }))
    : [{ reps: 0, weight: 0, intensity: 0 }];
  setsCountSelect.value = String(sets.length);

  const setsContainer = form.createDiv({ cls: 'workout-sets-container' });

  const setInputs: {
    repsInput: HTMLInputElement;
    weightInput: HTMLInputElement;
    intensityInput: HTMLInputElement;
  }[] = [];

  /** Render a smart weight picker that starts coarse (10 kg) and refines (2.5 kg) */
  function renderWeightPicker(
    parent: HTMLElement,
    currentWeight: number,
    onSelect: (w: number) => void
  ) {
    parent.empty();
    parent.addClass('weight-picker');

    // free-form input always visible
    const freeInput = parent.createEl('input', {
      type: 'number',
      value: currentWeight ? String(currentWeight) : '',
      placeholder: 'Вес',
      cls: 'workout-input workout-input-small weight-free-input'
    });
    freeInput.addEventListener('input', () => {
      const v = parseFloat(freeInput.value);
      if (Number.isFinite(v) && v >= 0) onSelect(v);
    });

    const chipsRow = parent.createDiv({ cls: 'weight-chips' });

    function showCoarse() {
      chipsRow.empty();
      COARSE_WEIGHTS.forEach(w => {
        const chip = chipsRow.createEl('button', {
          text: `${w}`,
          cls: `weight-chip${w === currentWeight ? ' active' : ''}`
        });
        chip.type = 'button';
        chip.tabIndex = -1;
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          // switch to fine-grained around this value
          onSelect(w);
          freeInput.value = String(w);
          showFine(w);
        });
      });
    }

    function showFine(centre: number) {
      chipsRow.empty();
      // back button to coarse
      const backChip = chipsRow.createEl('button', { text: '← все', cls: 'weight-chip weight-chip-back' });
      backChip.type = 'button';
      backChip.tabIndex = -1;
      backChip.addEventListener('click', (e) => { e.preventDefault(); showCoarse(); });

      fineWeights(centre).forEach(w => {
        const chip = chipsRow.createEl('button', {
          text: `${w}`,
          cls: `weight-chip${w === currentWeight ? ' active' : ''}`
        });
        chip.type = 'button';
        chip.tabIndex = -1;
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          onSelect(w);
          freeInput.value = String(w);
          // update active state
          chipsRow.querySelectorAll('.weight-chip').forEach(c => c.removeClass('active'));
          chip.addClass('active');
        });
      });
    }

    // start with appropriate view
    if (currentWeight > 0 && COARSE_WEIGHTS.includes(currentWeight)) {
      showFine(currentWeight);
    } else if (currentWeight > 0) {
      // find nearest coarse
      const nearest = COARSE_WEIGHTS.reduce((a, b) => Math.abs(b - currentWeight) < Math.abs(a - currentWeight) ? b : a, 0);
      showFine(nearest);
    } else {
      showCoarse();
    }
  }

  const renderSets = () => {
    setsContainer.empty();
    setInputs.length = 0;

    sets.forEach((set, index) => {
      const setRow = setsContainer.createDiv({ cls: 'workout-set-row' });
      setRow.createEl('span', { text: `Подход ${index + 1}:`, cls: 'set-label' });

      const repsInput = setRow.createEl('input', {
        type: 'number',
        value: (set.reps !== undefined && set.reps !== null && set.reps !== 0) ? set.reps.toString() : '',
        placeholder: 'Повторы',
        cls: 'workout-input workout-input-small'
      });
      setRow.createEl('span', { text: 'раз' });

      // Weight picker container
      const weightPickerContainer = setRow.createDiv({ cls: 'weight-picker-container' });
      const weightInput = document.createElement('input') as HTMLInputElement;
      weightInput.type = 'hidden';
      weightInput.value = (set.weight !== undefined && set.weight !== null && set.weight !== 0) ? set.weight.toString() : '';
      setRow.appendChild(weightInput);

      renderWeightPicker(weightPickerContainer, set.weight || 0, (w) => {
        weightInput.value = String(w);
        set.weight = w;
        // auto-calc intensity
        const oneRM = oneRMInput.valueAsNumber;
        if (Number.isFinite(oneRM) && oneRM > 0) {
          const intensity = calculateIntensity(w, oneRM);
          intensityInput.value = intensity.toString();
          set.intensity = intensity;
        }
      });

      const intensityInput = setRow.createEl('input', {
        type: 'number',
        value: (set.intensity !== undefined && set.intensity !== null && set.intensity !== 0) ? set.intensity.toString() : '',
        placeholder: '%',
        cls: 'workout-input workout-input-small'
      });
      intensityInput.min = '0';
      intensityInput.max = '100';
      setRow.createEl('span', { text: '% от 1ПМ' });

      // intensity → weight
      intensityInput.addEventListener('input', () => {
        const intensity = intensityInput.valueAsNumber;
        const oneRM = oneRMInput.valueAsNumber;
        if (Number.isFinite(oneRM) && Number.isFinite(intensity) && intensity >= 0 && intensity <= 100) {
          const weight = calculateWeight(intensity, oneRM);
          weightInput.value = weight.toString();
          set.weight = weight;
          renderWeightPicker(weightPickerContainer, weight, (w) => {
            weightInput.value = String(w);
            set.weight = w;
            const newIntensity = calculateIntensity(w, oneRM);
            intensityInput.value = newIntensity.toString();
            set.intensity = newIntensity;
          });
        }
      });

      setInputs.push({ repsInput, weightInput, intensityInput });
    });
  };

  // 1RM change → recalc all intensities (registered ONCE outside renderSets)
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

  // Sync sets array when dropdown changes
  setsCountSelect.addEventListener('change', () => {
    // save current values
    setInputs.forEach((input, i) => {
      if (sets[i]) {
        sets[i].reps = Number.isFinite(input.repsInput.valueAsNumber) ? input.repsInput.valueAsNumber : 0;
        sets[i].weight = Number.isFinite(parseFloat(input.weightInput.value)) ? parseFloat(input.weightInput.value) : 0;
        sets[i].intensity = Number.isFinite(input.intensityInput.valueAsNumber) ? input.intensityInput.valueAsNumber : 0;
      }
    });
    const target = parseInt(setsCountSelect.value);
    while (sets.length < target) sets.push({ reps: 0, weight: 0, intensity: 0 });
    while (sets.length > target) sets.pop();
    renderSets();
  });

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
