import { WorkoutTrackerSettings } from './types';

export const DEFAULT_SETTINGS: WorkoutTrackerSettings = {
  workoutFile: 'workout-tracker.md',
  exerciseLibraryFile: 'exercises.json',
  defaultView: 'week',
  colorScheme: 'default',
  autoSave: true,
  language: 'ru',
  customWorkoutTypes: ['грудь', 'спина', 'ноги', 'плечи', 'руки', 'пресс', 'кардио', 'другое']
};

export const LOCALIZATION = {
  ru: {
    // Общие
    'save': 'Сохранить',
    'cancel': 'Отмена',
    'delete': 'Удалить',
    'edit': 'Редактировать',
    'add': 'Добавить',
    'search': 'Поиск',
    'export': 'Экспорт',
    'import': 'Импорт',
    
    // Виды
    'week_view': 'Неделя',
    'month_view': 'Месяц',
    'year_view': 'Год',
    'progress_view': 'Прогресс',
    'spec_view': 'Упражнения',
    
    // Статусы
    'done': 'Выполнено',
    'planned': 'Запланировано',
    'skipped': 'Пропущено',
    'illness': 'Болезнь',
    
    // Тренировки
    'workout': 'Тренировка',
    'exercise': 'Упражнение',
    'sets': 'Подходы',
    'reps': 'Повторы',
    'weight': 'Вес',
    'duration': 'Длительность',
    'notes': 'Заметки',
    'add_exercise': 'Добавить упражнение',
    'add_set': 'Добавить подход',
    'muscle_group': 'Группа мышц',
    
    // Группы мышц
    'chest': 'Грудь',
    'back': 'Спина',
    'legs': 'Ноги',
    'shoulders': 'Плечи',
    'arms': 'Руки',
    'abs': 'Пресс',
    'cardio': 'Кардио',
    'other': 'Другое',
    
    // Графики
    'progress_chart': 'График прогресса',
    'weight_progress': 'Прогресс веса',
    'volume_progress': 'Прогресс объёма',
    'select_exercise': 'Выберите упражнение',
    'select_muscle_group': 'Выберите группу мышц',
    'date_range': 'Диапазон дат',
    
    // Ошибки
    'error_loading_data': 'Ошибка загрузки данных',
    'error_saving_data': 'Ошибка сохранения данных',
    'file_not_found': 'Файл не найден',
    'invalid_format': 'Неверный формат данных'
  }
};