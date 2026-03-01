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

  // Add native dropdown (datalist) populated from exercise library + recent workout names
  const dataListId = `exercise-names-${Date.now()}`;
  const nameDatalist = nameInputContainer.createEl('datalist', { cls: 'exercise-names-datalist' });
  nameDatalist.id = dataListId;
  nameInput.setAttribute('list', dataListId);

  // Toggle to search across all exercises (off = prefer current workout type)
  const searchAllContainer = nameInputContainer.createDiv({ cls: 'search-all-container' });
  const searchAllLabel = searchAllContainer.createEl('label', { text: 'Искать по всем упражнениям' });
  const searchAllCheckbox = searchAllContainer.createEl('input', { type: 'checkbox', cls: 'search-all-checkbox' }) as HTMLInputElement;
  searchAllLabel.prepend(searchAllCheckbox);

  // Populate datalist with names, optionally filtered by workout type
  let cachedLibNames: string[] = [];
  let cachedWorkoutNames: string[] = [];

  async function loadNames() {
    try {
      const lib = await ctx.plugin.dataManager.getExerciseLibrary();
      const workoutData = await ctx.plugin.dataManager.getWorkoutData();
      cachedLibNames = Object.keys(lib.exercises || {});
      const workoutNamesSet = new Set<string>();
      Object.values(workoutData).forEach(w => {
        if (w.exercises) w.exercises.forEach(e => workoutNamesSet.add(e.name));
      });
      cachedWorkoutNames = Array.from(workoutNamesSet);
    } catch (e) {
      cachedLibNames = [];
      cachedWorkoutNames = [];
    }
  }

  function populateDatalist(searchAll: boolean) {
    nameDatalist.empty();
    const groupFilter = workout && workout.type ? workout.type.toLowerCase() : undefined;
    const candidates = new Set<string>();
    if (searchAll) {
      cachedLibNames.forEach(n => candidates.add(n));
      cachedWorkoutNames.forEach(n => candidates.add(n));
    } else {
      // prefer exercises from library matching workout type
      cachedLibNames.forEach(n => {
        try {
          const spec = ctx.plugin.dataManager.getExerciseLibrary().then(lib => lib.exercises[n]);
        } catch (e) {
          // ignore
        }
      });
      // We'll perform a best-effort filter using stored specs synchronously where possible
      // Fallback: include cached workout names if no library match
      cachedWorkoutNames.forEach(n => candidates.add(n));
      // Also include any library names that include the groupFilter text
      if (groupFilter) {
        cachedLibNames.forEach(n => {
          if (n.toLowerCase().includes(groupFilter) || n.toLowerCase().includes(groupFilter.split(' ')[0])) {
            candidates.add(n);
          }
        });
      } else {
        cachedLibNames.forEach(n => candidates.add(n));
      }
    }
    Array.from(candidates).sort().forEach(n => nameDatalist.createEl('option', { value: n }));
  }

  // initial load + populate
  loadNames().then(() => populateDatalist(false));
  searchAllCheckbox.addEventListener('change', () => populateDatalist(searchAllCheckbox.checked));

  // Контейнер для предложений
  const suggestionsContainer = nameInputContainer.createDiv({
    cls: 'workout-suggestions-container'
  });
  suggestionsContainer.style.display = 'none';

  // 1RM is estimated from sets; no manual input required


  // Автодополнение для названий упражнений и авто-подстановка 1ПМ
  let suggestionsTimeout: NodeJS.Timeout;
  let searchTimeout: NodeJS.Timeout;
  nameInput.addEventListener('input', () => {
    // suggestions
    clearTimeout(suggestionsTimeout);
    suggestionsTimeout = setTimeout(async () => {
      const inputValue = nameInput.value.trim().toLowerCase();
      if (inputValue.length >= 2) {
        const suggestions = await getExerciseSuggestions(ctx.plugin, inputValue);
        showSuggestions(
          suggestions,
          suggestionsContainer,
          nameInput,
          ctx.sourcePath,
          ctx.plugin,
          (name) => showCreateExerciseForm(ctx.plugin, name)
        );
      } else {
        suggestionsContainer.style.display = 'none';
      }
    }, 300);

    // no manual 1RM; estimation will be derived from sets
  });

  // Скрываем предложения при клике вне (with cleanup via AbortController)
  const suggestionsAbort = new AbortController();
  document.addEventListener('click', (e) => {
    if (!nameInputContainer.contains(e.target as Node)) {
      suggestionsContainer.style.display = 'none';
    }
  }, { signal: suggestionsAbort.signal });



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

  // Estimate 1RM from available sets using Epley formula: w*(1+reps/30)
  function estimateOneRMFromSets(): number | undefined {
    if (!sets || !sets.length) return undefined;
    let best = 0;
    sets.forEach(s => {
      if (s.weight && s.weight > 0 && s.reps && s.reps > 0) {
        const est = s.weight * (1 + (s.reps / 30));
        if (est > best) best = est;
      }
    });
    return best > 0 ? Math.round(best) : undefined;
  }

  /** Render reps picker: chips 1..16 and a free input; max 16 */
  function renderRepsPicker(
    parent: HTMLElement,
    currentReps: number,
    onSelect: (r: number) => void
  ) {
    parent.empty();
    parent.addClass('reps-picker');

    // free-form input
    const freeInput = parent.createEl('input', {
      type: 'number',
      value: currentReps && currentReps > 0 ? String(currentReps) : '',
      placeholder: 'Повторы',
      cls: 'workout-input workout-input-small reps-free-input'
    }) as HTMLInputElement;
    freeInput.min = '1';
    freeInput.max = '16';
    freeInput.addEventListener('input', () => {
      const v = parseInt(freeInput.value, 10);
      if (Number.isFinite(v) && v > 0) {
        const capped = Math.min(16, Math.max(1, v));
        onSelect(capped);
      }
    });

    const chipsRow = parent.createDiv({ cls: 'reps-chips' });
    for (let r = 1; r <= 16; r++) {
      const chip = chipsRow.createEl('button', {
        text: String(r),
        cls: `reps-chip${r === currentReps ? ' active' : ''}`
      });
      chip.type = 'button';
      chip.tabIndex = -1;
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        onSelect(r);
        freeInput.value = String(r);
        chipsRow.querySelectorAll('.reps-chip').forEach(c => c.removeClass('active'));
        chip.addClass('active');
      });
    }
  }

  const renderSets = () => {
    setsContainer.empty();
    setInputs.length = 0;

    sets.forEach((set, index) => {
      const setRow = setsContainer.createDiv({ cls: 'workout-set-row' });
      setRow.createEl('span', { text: `Подход ${index + 1}:`, cls: 'set-label' });

      // reps picker (chips 1..16 + free input). store value in hidden repsInput
      const repsPickerContainer = setRow.createDiv({ cls: 'reps-picker-container' });
      const repsInput = document.createElement('input') as HTMLInputElement;
      repsInput.type = 'number';
      repsInput.style.display = 'none';
      repsInput.min = '1';
      repsInput.max = '16';
      repsInput.value = (set.reps !== undefined && set.reps !== null && set.reps !== 0) ? set.reps.toString() : '';
      setRow.appendChild(repsInput);
      renderRepsPicker(repsPickerContainer, set.reps || 0, (r) => {
        repsInput.value = String(r);
        set.reps = r;
        // Recalculate intensities since estimated 1RM may have changed
        recalcAllIntensities();
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
        // auto-calc intensity using estimated 1RM from sets
        const oneRM = estimateOneRMFromSets();
        if (oneRM && Number.isFinite(oneRM) && oneRM > 0) {
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
        const oneRM = estimateOneRMFromSets();
        if (oneRM && Number.isFinite(oneRM) && Number.isFinite(intensity) && intensity >= 0 && intensity <= 100) {
          const weight = calculateWeight(intensity, oneRM);
          weightInput.value = weight.toString();
          set.weight = weight;
          renderWeightPicker(weightPickerContainer, weight, (w) => {
            weightInput.value = String(w);
            set.weight = w;
            const newIntensity = calculateIntensity(w, oneRM!);
            intensityInput.value = newIntensity.toString();
            set.intensity = newIntensity;
          });
        }
      });

      setInputs.push({ repsInput, weightInput, intensityInput });
    });
  };

  // Recalculate intensities for all sets using estimated 1RM
  function recalcAllIntensities() {
    const oneRM = estimateOneRMFromSets();
    if (!oneRM || !setInputs.length) return;
    setInputs.forEach((input, i) => {
      const w = Number.parseFloat(input.weightInput.value) || 0;
      if (w > 0) {
        const intensity = calculateIntensity(w, oneRM);
        input.intensityInput.value = String(intensity);
        if (sets[i]) sets[i].intensity = intensity;
      }
    });
  }

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
    recalcAllIntensities();
  });

  renderSets();
  recalcAllIntensities();

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

    const exerciseData = {
      name,
      sets: exerciseSets,
      notes: notesInput.value.trim() || undefined
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
