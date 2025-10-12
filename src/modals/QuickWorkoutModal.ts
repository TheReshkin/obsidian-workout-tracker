import { App, Modal, Setting, Notice } from 'obsidian';
import WorkoutTrackerPlugin from '../main';
import { WorkoutEntry } from '../types';

export class QuickWorkoutModal extends Modal {
  plugin: WorkoutTrackerPlugin;
  workoutDate: string;
  muscleGroup: string = '';
  notes: string = '';

  constructor(app: App, plugin: WorkoutTrackerPlugin, date?: string) {
    super(app);
    this.plugin = plugin;
    this.workoutDate = date || new Date().toISOString().split('T')[0];
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Быстрое добавление тренировки' });

    new Setting(contentEl)
      .setName('Дата тренировки')
      .setDesc('Дата для которой создается тренировка')
      .addText(text => text
        .setValue(this.workoutDate)
        .onChange((value) => {
          this.workoutDate = value;
        }));

    new Setting(contentEl)
      .setName('Тип тренировки')
      .setDesc('Группа мышц или тип тренировки')
      .addDropdown(dropdown => {
        dropdown
          .addOption('', 'Выберите тип...')
          .addOption('грудь', 'Грудь')
          .addOption('спина', 'Спина')
          .addOption('ноги', 'Ноги')
          .addOption('плечи', 'Плечи')
          .addOption('руки', 'Руки')
          .addOption('пресс', 'Пресс')
          .addOption('кардио', 'Кардио')
          .addOption('другое', 'Другое')
          .setValue(this.muscleGroup)
          .onChange((value) => {
            this.muscleGroup = value;
          });
      });

    new Setting(contentEl)
      .setName('Заметки')
      .setDesc('Дополнительная информация о тренировке')
      .addTextArea(text => text
        .setPlaceholder('Запланированные упражнения, цели тренировки...')
        .setValue(this.notes)
        .onChange((value) => {
          this.notes = value;
        }));

    const actionsContainer = contentEl.createDiv({ cls: 'workout-quick-actions' });

    new Setting(actionsContainer)
      .addButton(btn => btn
        .setButtonText('Добавить как запланированную')
        .setCta()
        .onClick(() => {
          this.createWorkout('planned');
        }))
      .addButton(btn => btn
        .setButtonText('Добавить как выполненную')
        .onClick(() => {
          this.createWorkout('done');
        }))
      .addButton(btn => btn
        .setButtonText('Отмена')
        .onClick(() => {
          this.close();
        }));

    // Если дата - сегодня или раньше, предлагаем добавить как выполненную
    const today = new Date().toISOString().split('T')[0];
    if (this.workoutDate <= today) {
      contentEl.createEl('p', { 
        text: '💡 Совет: для прошедших дат лучше использовать "выполненную"',
        cls: 'workout-hint'
      });
    }
  }

  async createWorkout(status: 'planned' | 'done') {
    if (!this.muscleGroup) {
      new Notice('Выберите тип тренировки');
      return;
    }

    try {
      const workout: WorkoutEntry = {
        status: status,
        type: this.muscleGroup,
        notes: this.notes || undefined
      };

      await this.plugin.dataManager.addWorkout(this.workoutDate, workout);
      
      new Notice(`Тренировка ${status === 'done' ? 'выполнена' : 'запланирована'} на ${this.workoutDate}`);
      this.close();
      
      // Обновляем интерфейс плагина если он открыт
      const workoutView = this.app.workspace.getLeavesOfType('workout-tracker-view')[0];
      if (workoutView) {
        // @ts-ignore
        workoutView.view.refresh();
      }
      
    } catch (error) {
      console.error('Error creating quick workout:', error);
      new Notice('Ошибка при создании тренировки');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}