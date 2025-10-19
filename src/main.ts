import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { WorkoutTrackerSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { DataManager } from './data/data-manager';
import { WorkoutFileModal } from './modals/WorkoutFileModal';
import { WorkoutTemplateModal } from './modals/WorkoutTemplateModal';
import { QuickWorkoutModal } from './modals/QuickWorkoutModal';
import { WorkoutMarkdownProcessor } from './processors/WorkoutMarkdownProcessor';

export default class WorkoutTrackerPlugin extends Plugin {
  settings: WorkoutTrackerSettings;
  dataManager: DataManager;
  markdownProcessor: WorkoutMarkdownProcessor;

  async onload() {
    await this.loadSettings();
    
    // Инициализируем менеджер данных
    this.dataManager = new DataManager(
      this.app,
      this.settings.workoutFile,
      this.settings.exerciseLibraryFile
    );

    // Предзагружаем данные
    try {
      await this.dataManager.loadWorkoutData();
      await this.dataManager.loadExerciseLibrary();
    } catch (error) {
      console.error('Ошибка предзагрузки данных:', error);
    }

    // Инициализируем и регистрируем процессор markdown
    this.markdownProcessor = new WorkoutMarkdownProcessor(this);
    this.markdownProcessor.register();

    // expose helper for opening single-day view via UI components
    (this as any).openSingleDayView = async (date: string) => {
      try {
        // create a temporary InlineWorkoutEditor to render modal
        const workoutData = await this.dataManager.loadWorkoutData();
        const InlineEditorModule = await import('./processors/InlineWorkoutEditor');
        const editor = new InlineEditorModule.InlineWorkoutEditor(this, document.body as unknown as HTMLElement, workoutData || {}, {} as any, '');
        await editor.showSingleDayView(date);
      } catch (e) {
        console.error('Failed to open single-day view:', e);
      }
    };

    // Добавляем команды
    this.addCommand({
      id: 'create-workout-file',
      name: 'Создать новый файл тренировок',
      callback: () => {
        this.createNewWorkoutFile();
      }
    });

    this.addCommand({
      id: 'create-workout-template',
      name: 'Создать шаблон тренировки',
      callback: () => {
        this.createWorkoutTemplate();
      }
    });

    this.addCommand({
      id: 'quick-add-workout',
      name: 'Быстро добавить тренировку',
      callback: () => {
        this.quickAddWorkout();
      }
    });

    this.addCommand({
      id: 'init-exercise-library',
      name: 'Создать базовую библиотеку упражнений',
      callback: () => {
        this.initExerciseLibrary();
      }
    });

    // Command to open single-day view for the currently selected date in the UI
    this.addCommand({
      id: 'open-single-day-view',
      name: 'Открыть однодневный вид (Single-day view)',
      callback: () => {
        // plugin UI components can call plugin.openSingleDayView(date)
        // Default behavior: open today's date
        (this as any).openSingleDayView && (this as any).openSingleDayView(new Date().toISOString().split('T')[0]);
      }
    });

    // Добавляем вкладку настроек
    this.addSettingTab(new WorkoutTrackerSettingTab(this.app, this));
  }

  onunload() {
    // Очистка при выгрузке
  }

  async createNewWorkoutFile() {
    const modal = new WorkoutFileModal(this.app, this);
    modal.open();
  }

  async createWorkoutTemplate() {
    const modal = new WorkoutTemplateModal(this.app, this);
    modal.open();
  }

  async quickAddWorkout() {
    const modal = new QuickWorkoutModal(this.app, this);
    modal.open();
  }

  async initExerciseLibrary() {
    try {
      // Создаем базовую библиотеку упражнений
      const baseLibrary = {
        exercises: {
          // Грудь
          'Жим лёжа': { group: 'грудь', category: 'грудь', default_sets: 3, default_reps: 8 },
          'Жим гантелей': { group: 'грудь', category: 'грудь', default_sets: 3, default_reps: 10 },
          'Отжимания': { group: 'грудь', category: 'грудь', default_sets: 3, default_reps: 15 },
          
          // Спина
          'Подтягивания': { group: 'спина', category: 'спина', default_sets: 3, default_reps: 8 },
          'Тяга штанги': { group: 'спина', category: 'спина', default_sets: 3, default_reps: 8 },
          'Становая тяга': { group: 'спина', category: 'спина', default_sets: 3, default_reps: 5 },
          
          // Ноги
          'Приседания': { group: 'ноги', category: 'ноги', default_sets: 4, default_reps: 10 },
          'Жим ногами': { group: 'ноги', category: 'ноги', default_sets: 3, default_reps: 12 },
          'Выпады': { group: 'ноги', category: 'ноги', default_sets: 3, default_reps: 10 },
          
          // Плечи
          'Жим стоя': { group: 'плечи', category: 'плечи', default_sets: 3, default_reps: 8 },
          'Махи гантелями': { group: 'плечи', category: 'плечи', default_sets: 3, default_reps: 12 },
          
          // Руки
          'Подъёмы на бицепс': { group: 'руки', category: 'руки', default_sets: 3, default_reps: 12 },
          'Отжимания на брусьях': { group: 'руки', category: 'руки', default_sets: 3, default_reps: 10 }
        }
      };

      await this.app.vault.create(this.settings.exerciseLibraryFile, JSON.stringify(baseLibrary, null, 2));
      new Notice('Базовая библиотека упражнений создана!');
    } catch (error) {
      console.error('Ошибка создания библиотеки:', error);
      new Notice('Ошибка создания библиотеки упражнений');
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class WorkoutTrackerSettingTab extends PluginSettingTab {
  plugin: WorkoutTrackerPlugin;

  constructor(app: App, plugin: WorkoutTrackerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('Файл данных тренировок')
      .setDesc('Путь к markdown файлу для хранения данных тренировок')
      .addText(text => text
        .setPlaceholder('workout-tracker.md')
        .setValue(this.plugin.settings.workoutFile)
        .onChange(async (value) => {
          this.plugin.settings.workoutFile = value;
          await this.plugin.saveSettings();
          // Обновляем менеджер данных
          this.plugin.dataManager = new DataManager(
            this.app,
            value,
            this.plugin.settings.exerciseLibraryFile
          );
        }));

    new Setting(containerEl)
      .setName('Файл библиотеки упражнений')
      .setDesc('Путь к JSON файлу с библиотекой упражнений')
      .addText(text => text
        .setPlaceholder('exercises.json')
        .setValue(this.plugin.settings.exerciseLibraryFile)
        .onChange(async (value) => {
          this.plugin.settings.exerciseLibraryFile = value;
          await this.plugin.saveSettings();
          // Обновляем менеджер данных
          this.plugin.dataManager = new DataManager(
            this.app,
            this.plugin.settings.workoutFile,
            value
          );
        }));

    new Setting(containerEl)
      .setName('Вид по умолчанию')
      .setDesc('Какой вид открывать при запуске')
      .addDropdown(dropdown => dropdown
        .addOption('week', 'Неделя')
        .addOption('month', 'Месяц')
        .addOption('year', 'Год')
        .addOption('progress', 'Прогресс')
        .addOption('spec', 'Упражнения')
        .setValue(this.plugin.settings.defaultView)
        .onChange(async (value) => {
          this.plugin.settings.defaultView = value as any;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Автосохранение')
      .setDesc('Автоматически сохранять изменения')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSave)
        .onChange(async (value) => {
          this.plugin.settings.autoSave = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Язык интерфейса')
      .setDesc('Язык для интерфейса плагина')
      .addDropdown(dropdown => dropdown
        .addOption('ru', 'Русский')
        .addOption('en', 'English')
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => {
          this.plugin.settings.language = value;
          await this.plugin.saveSettings();
        }));
  }
}