import { WorkoutData } from '../../types';
import { MarkdownPostProcessorContext } from 'obsidian';
import { InlineWorkoutEditor } from '../InlineWorkoutEditor';

interface MonthWorkoutStats {
  totalWorkouts: number;
  completedWorkouts: number;
  workoutTypes: Record<string, number>;
}

/**
 * Подсчитывает статистику тренировок за конкретный месяц.
 */
export function getMonthWorkoutStats(
  year: number,
  month: number,
  workoutData: WorkoutData
): MonthWorkoutStats {
  const stats: MonthWorkoutStats = {
    totalWorkouts: 0,
    completedWorkouts: 0,
    workoutTypes: {},
  };

  Object.entries(workoutData).forEach(([dateStr, workout]) => {
    const date = new Date(dateStr);
    if (date.getFullYear() === year && date.getMonth() === month) {
      stats.totalWorkouts++;

      if (workout.status === 'done') {
        stats.completedWorkouts++;
      }

      const type = workout.type || 'другое';
      stats.workoutTypes[type] = (stats.workoutTypes[type] || 0) + 1;
    }
  });

  return stats;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/**
 * Рендерит годовой обзор (сетка из 12 месяцев с мини-статистикой).
 *
 * @param onNavigateToMonth  — колбэк для перехода к конкретному месяцу
 *                             при клике на карточку месяца.
 */
export function renderYearView(
  container: HTMLElement,
  currentDate: Date,
  workoutData: WorkoutData,
  onNavigateToMonth: (year: number, month: number) => void
): void {
  container.addClass('workout-year-view');

  const year = currentDate.getFullYear();
  const monthsGrid = container.createDiv({ cls: 'workout-year-months' });

  for (let month = 0; month < 12; month++) {
    const monthContainer = monthsGrid.createDiv({ cls: 'workout-year-month' });

    // Заголовок месяца
    const monthHeader = monthContainer.createDiv({ cls: 'workout-month-header' });
    monthHeader.textContent = MONTH_NAMES[month];

    // Подсветка текущего месяца
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth()) {
      monthContainer.addClass('current-month');
    }

    const monthStats = getMonthWorkoutStats(year, month, workoutData);

    // Полоски по типам тренировок
    const workoutBars = monthContainer.createDiv({ cls: 'workout-month-bars' });

    if (monthStats.totalWorkouts === 0) {
      workoutBars.createDiv({ cls: 'workout-month-empty', text: 'Нет записей' });
    } else {
      Object.entries(monthStats.workoutTypes).forEach(([type, count]) => {
        const bar = workoutBars.createDiv({ cls: 'workout-type-bar' });
        bar.setAttribute('data-type', type);
        bar.style.width = `${(count / monthStats.totalWorkouts) * 100}%`;
        bar.title = `${type}: ${count} тренировок`;
      });
    }

    // Статистика месяца (используем DOM API вместо innerHTML)
    const monthSummary = monthContainer.createDiv({ cls: 'workout-month-summary' });

    const totalStat = monthSummary.createDiv({ cls: 'month-stat' });
    totalStat.createSpan({ text: monthStats.totalWorkouts.toString(), cls: 'stat-number' });
    totalStat.createSpan({ text: 'тренировок', cls: 'stat-label' });

    const completedStat = monthSummary.createDiv({ cls: 'month-stat' });
    completedStat.createSpan({ text: monthStats.completedWorkouts.toString(), cls: 'stat-number' });
    completedStat.createSpan({ text: 'выполнено', cls: 'stat-label' });

    // Клик — переход к месяцу
    monthContainer.addEventListener('click', () => {
      onNavigateToMonth(year, month);
    });
  }
}
