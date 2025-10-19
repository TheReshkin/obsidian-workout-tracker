import { App, TFile, Notice } from 'obsidian';
import { WorkoutData, WorkoutEntry, ExerciseLibrary } from '../types';
import { WorkoutDataUtils } from '../utils/data-utils';

/**
 * Менеджер данных для работы с файлами тренировок
 */
export class DataManager {
  private app: App;
  private workoutFile: string;
  private exerciseLibraryFile: string;
  private workoutData: WorkoutData = {};
  private exerciseLibrary: ExerciseLibrary = { exercises: {} };

  constructor(app: App, workoutFile: string, exerciseLibraryFile: string) {
    this.app = app;
    this.workoutFile = workoutFile;
    this.exerciseLibraryFile = exerciseLibraryFile;
  }

  /**
   * Загружает данные тренировок из файла
   */
  async loadWorkoutData(): Promise<WorkoutData> {
    try {
      const file = this.app.vault.getAbstractFileByPath(this.workoutFile);
      
      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        this.workoutData = WorkoutDataUtils.parseWorkoutData(content);
      } else {
        // Файл не существует, создаем пустую структуру
        this.workoutData = {};
      }
      
      return this.workoutData;
    } catch (error) {
      console.error('Error loading workout data:', error);
      // Возвращаем пустую структуру вместо падения
      this.workoutData = {};
      return this.workoutData;
    }
  }

  /**
   * Сохраняет данные тренировок в файл
   */
  async saveWorkoutData(data: WorkoutData): Promise<void> {
    try {
      this.workoutData = data;
      const content = WorkoutDataUtils.serializeWorkoutData(data);
      
      const file = this.app.vault.getAbstractFileByPath(this.workoutFile);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      } else {
        await this.app.vault.create(this.workoutFile, content);
      }
      
      new Notice('Данные тренировок сохранены');
    } catch (error) {
      console.error('Error saving workout data:', error);
      new Notice('Ошибка сохранения данных тренировок');
    }
  }

  /**
   * Загружает библиотеку упражнений
   */
  async loadExerciseLibrary(): Promise<ExerciseLibrary> {
    try {
      const file = this.app.vault.getAbstractFileByPath(this.exerciseLibraryFile);
      
      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        this.exerciseLibrary = JSON.parse(content);
      } else {
        // Файл не существует, создаем базовую структуру
        this.exerciseLibrary = { exercises: {} };
      }
      
      return this.exerciseLibrary;
    } catch (error) {
      console.error('Error loading exercise library:', error);
      // Возвращаем пустую структуру вместо падения
      this.exerciseLibrary = { exercises: {} };
      return this.exerciseLibrary;
    }
  }

  /**
   * Сохраняет библиотеку упражнений
   */
  async saveExerciseLibrary(library: ExerciseLibrary): Promise<void> {
    try {
      this.exerciseLibrary = library;
      const content = JSON.stringify(library, null, 2);
      
      const file = this.app.vault.getAbstractFileByPath(this.exerciseLibraryFile);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      } else {
        await this.app.vault.create(this.exerciseLibraryFile, content);
      }
      
      new Notice('Библиотека упражнений сохранена');
    } catch (error) {
      console.error('Error saving exercise library:', error);
      new Notice('Ошибка сохранения библиотеки упражнений');
    }
  }

  /**
   * Создает файл тренировок с примером данных
   */
  private async createWorkoutFile(): Promise<void> {
    const sampleData: WorkoutData = {
      '2025-10-06': {
        status: 'done',
        type: 'грудь',
        exercises: [
          {
            name: 'Жим лёжа',
            sets: [
              { reps: 10, weight: 60 },
              { reps: 8, weight: 65 },
              { reps: 6, weight: 70 }
            ]
          },
          {
            name: 'Отжимания',
            sets: [
              { reps: 20 },
              { reps: 18 },
              { reps: 15 }
            ]
          }
        ],
        notes: 'Хорошая тренировка грудных мышц'
      },
      '2025-10-08': {
        status: 'planned',
        type: 'спина',
        notes: 'Подтягивания с дополнительным весом'
      }
    };

    const content = WorkoutDataUtils.serializeWorkoutData(sampleData);
    await this.app.vault.create(this.workoutFile, content);
    this.workoutData = sampleData;
  }

  /**
   * Создает файл библиотеки упражнений с базовым набором
   */
  private async createExerciseLibraryFile(): Promise<void> {
    const baseLibrary: ExerciseLibrary = {
      exercises: {
        // Грудь
        'Жим лёжа': { group: 'грудь', category: 'грудь', default_sets: 3, default_reps: 8 },
        'Жим гантелей': { group: 'грудь', category: 'грудь', default_sets: 3, default_reps: 10 },
        'Отжимания': { group: 'грудь', category: 'грудь', default_sets: 3, default_reps: 15 },
        'Разводка гантелей': { group: 'грудь', category: 'грудь', default_sets: 3, default_reps: 12 },
        
        // Спина
        'Подтягивания': { group: 'спина', category: 'спина', default_sets: 3, default_reps: 8 },
        'Тяга штанги': { group: 'спина', category: 'спина', default_sets: 3, default_reps: 8 },
        'Тяга гантели': { group: 'спина', category: 'спина', default_sets: 3, default_reps: 10 },
        'Становая тяга': { group: 'спина', category: 'спина', default_sets: 3, default_reps: 5 },
        
        // Ноги
        'Приседания': { group: 'ноги', category: 'ноги', default_sets: 4, default_reps: 10 },
        'Жим ногами': { group: 'ноги', category: 'ноги', default_sets: 3, default_reps: 12 },
        'Выпады': { group: 'ноги', category: 'ноги', default_sets: 3, default_reps: 10 },
        'Подъёмы на носки': { group: 'ноги', category: 'ноги', default_sets: 4, default_reps: 15 },
        
        // Плечи
        'Жим стоя': { group: 'плечи', category: 'плечи', default_sets: 3, default_reps: 8 },
        'Махи гантелями': { group: 'плечи', category: 'плечи', default_sets: 3, default_reps: 12 },
        'Тяга к подбородку': { group: 'плечи', category: 'плечи', default_sets: 3, default_reps: 10 },
        
        // Руки
        'Подъём на бицепс': { group: 'руки', category: 'руки', default_sets: 3, default_reps: 10 },
        'Жим узким хватом': { group: 'руки', category: 'руки', default_sets: 3, default_reps: 8 },
        'Французский жим': { group: 'руки', category: 'руки', default_sets: 3, default_reps: 10 },
        
        // Пресс
        'Скручивания': { group: 'пресс', category: 'пресс', default_sets: 3, default_reps: 20 },
        'Планка': { group: 'пресс', category: 'пресс', default_sets: 3, default_reps: 1 },
        'Подъёмы ног': { group: 'пресс', category: 'пресс', default_sets: 3, default_reps: 15 },
        
        // Кардио
        'Бег': { group: 'кардио', category: 'кардио', is_cardio: true, default_sets: 1 },
        'Велосипед': { group: 'кардио', category: 'кардио', is_cardio: true, default_sets: 1 },
        'Эллипс': { group: 'кардио', category: 'кардио', is_cardio: true, default_sets: 1 }
      }
    };

    const content = JSON.stringify(baseLibrary, null, 2);
    await this.app.vault.create(this.exerciseLibraryFile, content);
    this.exerciseLibrary = baseLibrary;
  }

  /**
   * Добавляет новую тренировку
   */
  async addWorkout(date: string, workout: WorkoutEntry): Promise<void> {
    const data = await this.loadWorkoutData();
    data[date] = workout;
    await this.saveWorkoutData(data);
  }

  /**
   * Обновляет существующую тренировку
   */
  async updateWorkout(date: string, workout: WorkoutEntry): Promise<void> {
    const data = await this.loadWorkoutData();
    if (data[date]) {
      data[date] = { ...data[date], ...workout };
      await this.saveWorkoutData(data);
    }
  }

  /**
   * Удаляет тренировку
   */
  async deleteWorkout(date: string): Promise<void> {
    const data = await this.loadWorkoutData();
    if (data[date]) {
      delete data[date];
      await this.saveWorkoutData(data);
    }
  }

  /**
   * Добавляет новое упражнение в библиотеку
   */
  async addExercise(name: string, spec: any): Promise<void> {
    try {
      // Ensure library file exists; if not, create a base file so users can add exercises
      const file = this.app.vault.getAbstractFileByPath(this.exerciseLibraryFile);
      if (!file) {
        await this.createExerciseLibraryFile();
      }

      const library = await this.loadExerciseLibrary();
      if (!library.exercises) library.exercises = {};
      library.exercises[name] = spec;
      await this.saveExerciseLibrary(library);
    } catch (error) {
      console.error('Error adding exercise to library:', error);
      throw error;
    }
  }

  /**
   * Получает текущие данные тренировок
   */
  async getWorkoutData(): Promise<WorkoutData> {
    // Загружаем свежие данные из файла
    await this.loadWorkoutData();
    return this.workoutData;
  }

  /**
   * Получает текущую библиотеку упражнений
   */
  async getExerciseLibrary(): Promise<ExerciseLibrary> {
    // Загружаем свежие данные из файла
    await this.loadExerciseLibrary();
    return this.exerciseLibrary;
  }
}