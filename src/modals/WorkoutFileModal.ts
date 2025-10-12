import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import WorkoutTrackerPlugin from '../main';
import { WorkoutData } from '../types';
import { WorkoutDataUtils } from '../utils/data-utils';

export class WorkoutFileModal extends Modal {
  plugin: WorkoutTrackerPlugin;
  fileName: string = '';
  fileDescription: string = '';
  includeExamples: boolean = true;

  constructor(app: App, plugin: WorkoutTrackerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Создать новый файл тренировок' });

    new Setting(contentEl)
      .setName('Название файла')
      .setDesc('Имя файла без расширения (будет добавлено .md)')
      .addText(text => text
        .setPlaceholder('my-workout-tracker')
        .setValue(this.fileName)
        .onChange((value) => {
          this.fileName = value;
        }));

    new Setting(contentEl)
      .setName('Описание')
      .setDesc('Краткое описание для чего создается файл')
      .addText(text => text
        .setPlaceholder('Тренировки 2025')
        .setValue(this.fileDescription)
        .onChange((value) => {
          this.fileDescription = value;
        }));

    new Setting(contentEl)
      .setName('Включить примеры')
      .setDesc('Добавить примеры тренировок для демонстрации формата')
      .addToggle(toggle => toggle
        .setValue(this.includeExamples)
        .onChange((value) => {
          this.includeExamples = value;
        }));

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Создать файл')
        .setCta()
        .onClick(() => {
          this.createFile();
        }))
      .addButton(btn => btn
        .setButtonText('Отмена')
        .onClick(() => {
          this.close();
        }));
  }

  async createFile() {
    if (!this.fileName) {
      new Notice('Введите название файла');
      return;
    }

    const fileName = this.fileName.endsWith('.md') ? this.fileName : `${this.fileName}.md`;
    
    // Проверяем, не существует ли уже файл с таким именем
    const existingFile = this.app.vault.getAbstractFileByPath(fileName);
    if (existingFile) {
      new Notice(`Файл ${fileName} уже существует`);
      return;
    }

    try {
      const workoutData: WorkoutData = this.includeExamples ? this.getExampleData() : {};
      const content = this.generateFileContent(workoutData);
      
      const file = await this.app.vault.create(fileName, content);
      
      // Открываем созданный файл
      await this.app.workspace.getLeaf().openFile(file);
      
      new Notice(`Файл тренировок ${fileName} успешно создан`);
      this.close();
      
    } catch (error) {
      console.error('Error creating workout file:', error);
      new Notice('Ошибка при создании файла');
    }
  }

  generateFileContent(workoutData: WorkoutData): string {
    const description = this.fileDescription || 'Файл для отслеживания тренировок';
    
    return `# ${this.fileName.replace('.md', '').replace(/[-_]/g, ' ')}

${description}

*Создано: ${new Date().toLocaleDateString('ru-RU')}*

---

## Как использовать

1. Откройте плагин Workout Tracker
2. В настройках укажите путь к этому файлу
3. Начните добавлять тренировки через интерфейс плагина

## Формат данных

Данные тренировок хранятся в JSON формате внутри блока кода:

\`\`\`workout
${JSON.stringify(workoutData, null, 2)}
\`\`\`

---

*Этот файл создан плагином Workout Tracker. Данные в JSON блоке совместимы с Dataview.*`;
  }

  getExampleData(): WorkoutData {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    return {
      [formatDate(yesterday)]: {
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
        notes: 'Хорошая тренировка'
      },
      [formatDate(today)]: {
        status: 'planned',
        type: 'спина',
        notes: 'Подтягивания с дополнительным весом'
      },
      [formatDate(tomorrow)]: {
        status: 'planned',
        type: 'ноги',
        exercises: [
          {
            name: 'Приседания',
            sets: [
              { reps: 12, weight: 80 },
              { reps: 10, weight: 85 },
              { reps: 8, weight: 90 }
            ]
          }
        ]
      }
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}