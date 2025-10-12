// Основные типы данных для Workout Tracker

export type WorkoutStatus = 'done' | 'planned' | 'skipped' | 'illness';

export interface WorkoutSet {
  reps: number;
  weight?: number;
  duration?: number; // для кардио упражнений в секундах
  distance?: number; // для бега в метрах
  intensity?: number; // процент от 1ПМ (0-100)
  oneRM?: number; // 1ПМ на момент выполнения упражнения
  notes?: string; // заметки к подходу
}

export interface Exercise {
  name: string;
  sets: WorkoutSet[];
  notes?: string;
  currentOneRM?: number; // текущий 1ПМ для расчета интенсивности
}

export interface WorkoutEntry {
  status: WorkoutStatus;
  type: string; // название группы мышц или типа тренировки
  exercises?: Exercise[];
  notes?: string;
  duration?: number; // общая длительность тренировки в минутах
  moved_from?: string; // дата, с которой была перенесена тренировка
  moved_to?: string; // дата, на которую была перенесена тренировка
  reason?: string; // причина болезни или пропуска
}

export interface WorkoutData {
  [date: string]: WorkoutEntry;
}

// Для хранения истории 1ПМ
export interface OneRMRecord {
  date: string;
  value: number; // вес в кг
  notes?: string; // заметки об установлении рекорда
}

export interface ExerciseSpec {
  group: string; // группа мышц
  category?: string; // категория упражнения
  equipment?: string; // оборудование
  difficulty?: 'начинающий' | 'средний' | 'продвинутый'; // сложность
  muscleGroups?: string[]; // список мышечных групп
  description?: string; // описание техники
  default_sets?: number;
  default_reps?: number;
  default_weight?: number;
  is_cardio?: boolean;
  oneRMHistory?: OneRMRecord[]; // история 1ПМ для данного упражнения
  currentOneRM?: number; // текущий 1ПМ
}

export interface ExerciseLibrary {
  exercises: {
    [exerciseName: string]: ExerciseSpec;
  };
}

export interface WorkoutTrackerSettings {
  workoutFile: string;
  exerciseLibraryFile: string;
  defaultView: ViewType;
  colorScheme: string;
  autoSave: boolean;
  language: string;
  customWorkoutTypes: string[]; // пользовательские типы тренировок
}

export type ViewType = 'week' | 'month' | 'year' | 'progress' | 'spec';

export interface ViewState {
  currentView: ViewType;
  selectedDate: string;
  selectedExercise?: string;
  selectedMuscleGroup?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Для графиков прогресса
export interface ProgressDataPoint {
  date: string;
  value: number;
  exercise: string;
  muscleGroup: string;
  reps?: number;
  weight?: number;
  volume?: number; // вес * повторы
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'area';
  dataKey: string;
  color: string;
  name: string;
}

// Цветовые схемы для групп мышц
export const MUSCLE_GROUP_COLORS: Record<string, string> = {
  'грудь': '#FF6B6B',
  'спина': '#4ECDC4',
  'ноги': '#45B7D1',
  'плечи': '#96CEB4',
  'руки': '#FFEAA7',
  'пресс': '#DDA0DD',
  'кардио': '#98D8C8',
  'другое': '#DCDCDC'
};

// Цвета для статусов тренировок
export const STATUS_COLORS: Record<WorkoutStatus, string> = {
  'done': '#28A745',
  'planned': '#007BFF',
  'skipped': '#FFC107',
  'illness': '#DC3545'
};