import { TFile } from 'obsidian';
import WorkoutTrackerPlugin from '../../main';
import { ExerciseSpec } from '../../types';

/**
 * Получает предложения для автодополнения упражнений
 */
export async function getExerciseSuggestions(plugin: WorkoutTrackerPlugin, input: string): Promise<string[]> {
  try {
    // Получаем упражнения из библиотеки
    const libraryData = await plugin.dataManager.getExerciseLibrary();
    const libraryExercises = Object.keys(libraryData.exercises || {});

    // Получаем упражнения из тренировок
    const workoutData = await plugin.dataManager.getWorkoutData();
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
      .slice(0, 8);

    return filtered;
  } catch (error) {
    console.error('Ошибка при получении предложений упражнений:', error);
    return [];
  }
}

/**
 * Показывает предложения для автодополнения
 */
export function showSuggestions(
  suggestions: string[],
  container: HTMLElement,
  nameInput: HTMLInputElement,
  sourcePath: string,
  plugin: WorkoutTrackerPlugin,
  onCreateNew?: (name: string) => void
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

        if (onCreateNew) {
          onCreateNew(inputValue);
        }
      });
    }

    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

/**
 * Получает данные упражнения из библиотеки файлов
 */
export async function getExerciseFromLibrary(
  plugin: WorkoutTrackerPlugin,
  sourcePath: string,
  exerciseName: string
): Promise<ExerciseSpec | null> {
  try {
    const currentDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));

    const files = plugin.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (file.path.startsWith(currentDir)) {
        const content = await plugin.app.vault.read(file);
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
