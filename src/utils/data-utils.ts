import { WorkoutData, WorkoutEntry, ExerciseLibrary, ProgressDataPoint } from '../types';

/**
 * Утилиты для работы с датами
 */
export class DateUtils {
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static parseDate(dateStr: string): Date {
    return new Date(dateStr);
  }

  static getWeekDates(date: Date): string[] {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Понедельник как первый день
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      week.push(this.formatDate(currentDate));
    }
    return week;
  }

  static getMonthDates(date: Date): string[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const dates = [];
    for (let day = 1; day <= lastDay.getDate(); day++) {
      dates.push(this.formatDate(new Date(year, month, day)));
    }
    return dates;
  }

  static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  static getDayName(date: Date): string {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[date.getDay()];
  }

  static getMonthName(date: Date): string {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[date.getMonth()];
  }
}

/**
 * Утилиты для работы с данными тренировок
 */
export class WorkoutDataUtils {
  /**
   * Парсит JSON-данные из markdown файла
   */
  static parseWorkoutData(content: string): WorkoutData {
    try {
      const jsonMatch = content.match(/```workout\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return {};
    } catch (error) {
      console.error('Error parsing workout data:', error);
      return {};
    }
  }

  /**
   * Сериализует данные тренировок в markdown формат
   */
  static serializeWorkoutData(data: WorkoutData): string {
    const jsonStr = JSON.stringify(data, null, 2);
    return `# Workout Tracker Data

\`\`\`workout
${jsonStr}
\`\`\`

*Этот файл содержит данные тренировок в формате, совместимом с Dataview. Не редактируйте его вручную.*`;
  }

  /**
   * Получает данные для диапазона дат
   */
  static getDataForDateRange(data: WorkoutData, startDate: string, endDate: string): WorkoutData {
    const result: WorkoutData = {};
    const start = new Date(startDate);
    const end = new Date(endDate);

    Object.keys(data).forEach(dateStr => {
      const date = new Date(dateStr);
      if (date >= start && date <= end) {
        result[dateStr] = data[dateStr];
      }
    });

    return result;
  }

  /**
   * Вычисляет общий объём тренировки (вес * повторы)
   */
  static calculateWorkoutVolume(workout: WorkoutEntry): number {
    if (!workout.exercises) return 0;
    
    return workout.exercises.reduce((total, exercise) => {
      const exerciseVolume = exercise.sets.reduce((setTotal, set) => {
        return setTotal + (set.reps * (set.weight || 0));
      }, 0);
      return total + exerciseVolume;
    }, 0);
  }

  /**
   * Получает все уникальные упражнения из данных
   */
  static getAllExercises(data: WorkoutData): string[] {
    const exercises = new Set<string>();
    
    Object.values(data).forEach(workout => {
      if (workout.exercises) {
        workout.exercises.forEach(exercise => {
          exercises.add(exercise.name);
        });
      }
    });

    return Array.from(exercises).sort();
  }

  /**
   * Получает все уникальные группы мышц
   */
  static getAllMuscleGroups(data: WorkoutData): string[] {
    const groups = new Set<string>();
    
    Object.values(data).forEach(workout => {
      if (workout.type) {
        groups.add(workout.type);
      }
    });

    return Array.from(groups).sort();
  }

  /**
   * Генерирует данные для графиков прогресса
   */
  static generateProgressData(
    data: WorkoutData, 
    exerciseName?: string, 
    muscleGroup?: string
  ): ProgressDataPoint[] {
    const progressData: ProgressDataPoint[] = [];

    Object.entries(data).forEach(([dateStr, workout]) => {
      if (workout.status !== 'done' || !workout.exercises) return;

      workout.exercises.forEach(exercise => {
        if (exerciseName && exercise.name !== exerciseName) return;
        if (muscleGroup && workout.type !== muscleGroup) return;

        exercise.sets.forEach((set, setIndex) => {
          progressData.push({
            date: dateStr,
            value: set.weight || 0,
            exercise: exercise.name,
            muscleGroup: workout.type,
            reps: set.reps,
            weight: set.weight,
            volume: (set.weight || 0) * set.reps
          });
        });
      });
    });

    return progressData.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Переносит тренировку на другую дату
   */
  static moveWorkout(data: WorkoutData, fromDate: string, toDate: string): WorkoutData {
    const newData = { ...data };
    
    if (newData[fromDate]) {
      const workout = { ...newData[fromDate] };
      workout.moved_from = fromDate;
      
      // Обновляем исходную запись
      newData[fromDate] = {
        ...newData[fromDate],
        moved_to: toDate,
        status: 'skipped'
      };
      
      // Создаем новую запись
      newData[toDate] = workout;
    }

    return newData;
  }

  /**
   * Отмечает период болезни
   */
  static markIllnessPeriod(
    data: WorkoutData, 
    startDate: string, 
    endDate: string, 
    reason: string
  ): WorkoutData {
    const newData = { ...data };
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Проходим по всем дням в диапазоне
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = DateUtils.formatDate(date);
      
      newData[dateStr] = {
        status: 'illness',
        type: 'болезнь',
        reason: reason
      };
    }

    return newData;
  }
}

/**
 * Утилиты для экспорта данных
 */
export class ExportUtils {
  /**
   * Подготавливает данные для экспорта в Excel
   */
  static prepareExportData(data: WorkoutData): any[] {
    const exportData: any[] = [];

    Object.entries(data).forEach(([dateStr, workout]) => {
      if (workout.exercises) {
        workout.exercises.forEach(exercise => {
          exercise.sets.forEach((set, setIndex) => {
            exportData.push({
              'Дата': dateStr,
              'Статус': workout.status,
              'Тип тренировки': workout.type,
              'Упражнение': exercise.name,
              'Подход': setIndex + 1,
              'Повторы': set.reps,
              'Вес': set.weight || '',
              'Длительность': set.duration || '',
              'Дистанция': set.distance || '',
              'Объём': (set.weight || 0) * set.reps,
              'Заметки': exercise.notes || workout.notes || ''
            });
          });
        });
      } else {
        // Тренировки без упражнений (болезнь, пропуск)
        exportData.push({
          'Дата': dateStr,
          'Статус': workout.status,
          'Тип тренировки': workout.type,
          'Упражнение': '',
          'Подход': '',
          'Повторы': '',
          'Вес': '',
          'Длительность': '',
          'Дистанция': '',
          'Объём': '',
          'Заметки': workout.notes || workout.reason || ''
        });
      }
    });

    return exportData;
  }
}