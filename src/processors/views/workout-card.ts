import { WorkoutData, WorkoutEntry } from '../../types';
import { InlineWorkoutEditor } from '../InlineWorkoutEditor';

/**
 * Рендерит карточку тренировки (используется в календаре/списке).
 *
 * @param compact  — true для компактного вида в календаре,
 *                   false для развёрнутого вида в списке.
 */
export function renderWorkoutCard(
  container: HTMLElement,
  workout: WorkoutEntry,
  dateStr: string,
  workoutData: WorkoutData,
  editor: InlineWorkoutEditor,
  compact: boolean = true
): void {
  const card = container.createDiv({ cls: `workout-card status-${workout.status}` });

  // Drag-n-drop
  card.draggable = true;
  card.setAttribute('data-workout-date', dateStr);

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer!.setData('text/plain', dateStr);
    e.dataTransfer!.setData('workout-data', JSON.stringify(workout));
    card.addClass('dragging');
  });

  card.addEventListener('dragend', () => {
    card.removeClass('dragging');
  });

  // Заголовок
  const cardHeader = card.createDiv({ cls: 'workout-card-header' });
  cardHeader.createSpan({ text: workout.type, cls: 'workout-type' });

  const cardActions = cardHeader.createDiv({ cls: 'workout-card-actions' });

  const editBtn = cardActions.createEl('button', { text: '✏️', cls: 'workout-action-btn' });
  editBtn.addEventListener('click', () => {
    editor.showEditWorkoutForm(dateStr, workout);
  });

  // Заметки
  if (workout.notes) {
    card.createDiv({ text: workout.notes, cls: 'workout-notes' });
  }

  // Упражнения
  if (workout.exercises && workout.exercises.length > 0) {
    const exercises = card.createDiv({
      cls: compact ? 'workout-exercises compact' : 'workout-exercises',
    });

    workout.exercises.forEach((exercise) => {
      const exerciseEl = exercises.createDiv({ cls: 'exercise-item' });
      exerciseEl.createDiv({ text: exercise.name, cls: 'exercise-name' });

      if (exercise.sets && exercise.sets.length > 0) {
        const ol = exerciseEl.createEl('ol', { cls: 'exercise-sets-list' });
        exercise.sets.forEach((set) => {
          const li = ol.createEl('li', { cls: 'exercise-set-detail' });
          let setText = `${set.reps} повт.`;
          if (set.weight && set.weight > 0) setText += ` × ${set.weight} кг`;
          if (set.intensity && set.intensity > 0) setText += ` (${Math.round(set.intensity)}%)`;
          if (set.notes) setText += ` - ${set.notes}`;
          li.textContent = setText;
        });
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
          const oneRmInfo = exerciseEl.createDiv({ cls: 'exercise-one-rm-info' });
          oneRmInfo.textContent = `1ПМ: ${Math.round(best)} кг`;
        }
      }
    });
  }
}
