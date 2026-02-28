import { WorkoutData, WorkoutEntry, MUSCLE_GROUP_COLORS } from '../../types';
import { applyLuminanceColor } from '../../utils/dom-helpers';

interface WorkoutStats {
  general: Record<string, number>;
  byMuscleGroup: Record<string, number>;
}

const STAT_LABELS: Record<string, string> = {
  total: 'Всего тренировок',
  done: 'Выполнено',
  planned: 'Запланировано',
  skipped: 'Пропущено',
  illness: 'Болезнь',
};

/**
 * Подсчитывает статистику по тренировочным данным.
 */
export function calculateStats(workoutData: WorkoutData): WorkoutStats {
  const stats: WorkoutStats = {
    general: { total: 0, done: 0, planned: 0, skipped: 0, illness: 0 },
    byMuscleGroup: {},
  };

  Object.values(workoutData).forEach((workout) => {
    stats.general.total++;
    if (stats.general[workout.status] !== undefined) {
      stats.general[workout.status]++;
    }

    const type = workout.type || 'другое';
    stats.byMuscleGroup[type] = (stats.byMuscleGroup[type] || 0) + 1;
  });

  return stats;
}

/**
 * Рендерит вид «Статистика» в указанный контейнер.
 */
export function renderStatsView(
  container: HTMLElement,
  workoutData: WorkoutData
): void {
  container.addClass('workout-stats-view');

  const stats = calculateStats(workoutData);

  // Общая статистика
  const generalStats = container.createDiv({ cls: 'workout-general-stats' });
  generalStats.createEl('h4', { text: 'Общая статистика' });

  const statsGrid = generalStats.createDiv({ cls: 'stats-grid' });

  Object.entries(stats.general).forEach(([key, value]) => {
    const statItem = statsGrid.createDiv({ cls: 'stat-item' });
    statItem.createSpan({ text: STAT_LABELS[key] || key, cls: 'stat-label' });
    statItem.createSpan({ text: value.toString(), cls: 'stat-value' });
  });

  // По группам мышц
  if (Object.keys(stats.byMuscleGroup).length > 0) {
    const muscleStats = container.createDiv({ cls: 'workout-muscle-stats' });
    muscleStats.createEl('h4', { text: 'По группам мышц' });

    Object.entries(stats.byMuscleGroup).forEach(([group, count]) => {
      const groupItem = muscleStats.createDiv({ cls: 'muscle-group-item' });
      const span = groupItem.createSpan({ text: group, cls: 'group-name pill' });

      const bg = MUSCLE_GROUP_COLORS[group];
      if (bg) {
        applyLuminanceColor(span, bg);
      }

      groupItem.createSpan({ text: count.toString(), cls: 'group-count' });
    });
  }
}
