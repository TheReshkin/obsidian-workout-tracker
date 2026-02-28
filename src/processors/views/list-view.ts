import { WorkoutData, WorkoutEntry } from '../../types';
import { InlineWorkoutEditor } from '../InlineWorkoutEditor';
import { renderWorkoutCard } from './workout-card';

/**
 * Рендерит вид «Список тренировок» — все тренировки в обратном хронологическом порядке.
 */
export function renderListView(
  container: HTMLElement,
  workoutData: WorkoutData,
  editor: InlineWorkoutEditor
): void {
  container.addClass('workout-list-view');

  const sortedDates = Object.keys(workoutData).sort().reverse();

  if (sortedDates.length === 0) {
    container.createEl('div', {
      text: 'Тренировки не найдены',
      cls: 'workout-empty-state',
    });
    return;
  }

  sortedDates.forEach((dateStr) => {
    const workout = workoutData[dateStr];
    const workoutItem = container.createDiv({ cls: 'workout-list-item' });

    const workoutDate = workoutItem.createDiv({ cls: 'workout-date' });
    workoutDate.createSpan({
      text: new Date(dateStr).toLocaleDateString('ru-RU'),
      cls: 'date-text',
    });
    workoutDate.createSpan({
      text: workout.status,
      cls: `status status-${workout.status}`,
    });

    renderWorkoutCard(workoutItem, workout, dateStr, workoutData, editor, false);
  });
}
