import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import WorkoutTrackerPlugin from '../main';
import { WorkoutEntry, Exercise } from '../types';

export class WorkoutTemplateModal extends Modal {
  plugin: WorkoutTrackerPlugin;
  templateName: string = '';
  muscleGroup: string = '';
  exercises: Exercise[] = [];

  constructor(app: App, plugin: WorkoutTrackerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Создать шаблон тренировки' });

    new Setting(contentEl)
      .setName('Название шаблона')
      .setDesc('Название для шаблона тренировки')
      .addText(text => text
        .setPlaceholder('Тренировка груди')
        .setValue(this.templateName)
        .onChange((value) => {
          this.templateName = value;
        }));

    new Setting(contentEl)
      .setName('Группа мышц')
      .setDesc('Основная группа мышц для этой тренировки')
      .addDropdown(dropdown => {
        dropdown
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
            this.updateExerciseSuggestions();
          });
      });

    // Контейнер для упражнений
    const exercisesContainer = contentEl.createDiv({ cls: 'workout-exercises-container' });
    this.renderExercises(exercisesContainer);

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Добавить упражнение')
        .onClick(() => {
          this.addExercise();
          this.renderExercises(exercisesContainer);
        }));

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Создать шаблон')
        .setCta()
        .onClick(() => {
          this.createTemplate();
        }))
      .addButton(btn => btn
        .setButtonText('Отмена')
        .onClick(() => {
          this.close();
        }));
  }

  renderExercises(container: HTMLElement) {
    container.empty();
    
    if (this.exercises.length === 0) {
      container.createEl('p', { text: 'Упражнения не добавлены', cls: 'workout-placeholder' });
      return;
    }

    this.exercises.forEach((exercise, index) => {
      const exerciseEl = container.createDiv({ cls: 'workout-exercise-item' });
      
      new Setting(exerciseEl)
        .setName(`Упражнение ${index + 1}`)
        .addText(text => text
          .setPlaceholder('Название упражнения')
          .setValue(exercise.name)
          .onChange((value) => {
            this.exercises[index].name = value;
          }))
        .addButton(btn => btn
          .setButtonText('Удалить')
          .setClass('mod-warning')
          .onClick(() => {
            this.exercises.splice(index, 1);
            this.renderExercises(container);
          }));

      // Подходы
      const setsContainer = exerciseEl.createDiv({ cls: 'workout-sets-container' });
      exercise.sets.forEach((set, setIndex) => {
        const setEl = setsContainer.createDiv({ cls: 'workout-set-item' });
        
        new Setting(setEl)
          .setName(`Подход ${setIndex + 1}`)
          .addText(text => text
            .setPlaceholder('Повторы')
            .setValue(set.reps.toString())
            .onChange((value) => {
              this.exercises[index].sets[setIndex].reps = parseInt(value) || 0;
            }))
          .addText(text => text
            .setPlaceholder('Вес (кг)')
            .setValue(set.weight?.toString() || '')
            .onChange((value) => {
              this.exercises[index].sets[setIndex].weight = parseFloat(value) || undefined;
            }))
          .addButton(btn => btn
            .setButtonText('×')
            .setClass('mod-warning')
            .onClick(() => {
              this.exercises[index].sets.splice(setIndex, 1);
              this.renderExercises(container);
            }));
      });

      new Setting(exerciseEl)
        .addButton(btn => btn
          .setButtonText('Добавить подход')
          .setClass('mod-cta')
          .onClick(() => {
            this.exercises[index].sets.push({ reps: 10, weight: 0 });
            this.renderExercises(container);
          }));
    });
  }

  addExercise() {
    this.exercises.push({
      name: '',
      sets: [{ reps: 10, weight: 0 }]
    });
  }

  updateExerciseSuggestions() {
    // Здесь можно добавить логику предложения упражнений на основе группы мышц
    // Пока что просто добавляем базовое упражнение
    if (this.exercises.length === 0) {
      this.addExercise();
    }
  }

  async createTemplate() {
    if (!this.templateName) {
      new Notice('Введите название шаблона');
      return;
    }

    if (!this.muscleGroup) {
      new Notice('Выберите группу мышц');
      return;
    }

    try {
      const template: WorkoutEntry = {
        status: 'planned',
        type: this.muscleGroup,
        exercises: this.exercises.filter(ex => ex.name.trim() !== ''),
        notes: `Шаблон: ${this.templateName}`
      };

      const fileName = `template-${this.templateName.toLowerCase().replace(/\s+/g, '-')}.md`;
      const content = this.generateTemplateContent(template);
      
      await this.app.vault.create(fileName, content);
      
      new Notice(`Шаблон ${this.templateName} создан`);
      this.close();
      
    } catch (error) {
      console.error('Error creating template:', error);
      new Notice('Ошибка при создании шаблона');
    }
  }

  generateTemplateContent(template: WorkoutEntry): string {
    return `# Шаблон тренировки: ${this.templateName}

**Группа мышц:** ${this.muscleGroup}
**Создано:** ${new Date().toLocaleDateString('ru-RU')}

## Упражнения

${template.exercises?.map(exercise => {
  return `### ${exercise.name}

${exercise.sets.map((set, index) => {
  return `**Подход ${index + 1}:** ${set.reps} повторов${set.weight ? ` × ${set.weight} кг` : ''}`;
}).join('\n')}`;
}).join('\n\n') || 'Упражнения не добавлены'}

## Как использовать

1. Скопируйте данные из блока ниже
2. Вставьте в файл тренировок на нужную дату
3. Отредактируйте веса и повторы по необходимости

## JSON данные

\`\`\`json
${JSON.stringify(template, null, 2)}
\`\`\`

---

*Шаблон создан плагином Workout Tracker*`;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}