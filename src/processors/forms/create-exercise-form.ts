import { Notice } from 'obsidian';
import WorkoutTrackerPlugin from '../../main';
import { createFullscreenModal, hideModal } from '../../utils/dom-helpers';

/**
 * Показывает форму создания нового упражнения в библиотеке
 */
export async function showCreateExerciseForm(
  plugin: WorkoutTrackerPlugin,
  exerciseName: string
) {
  const modal = createFullscreenModal();
  const form = modal.createDiv({ cls: 'workout-inline-form' });

  form.createEl('h4', { text: 'Создать новое упражнение' });

  // Название (заполнено)
  form.createEl('label', { text: 'Название упражнения:' });
  const nameInput = form.createEl('input', {
    type: 'text',
    value: exerciseName,
    cls: 'workout-input'
  });
  nameInput.disabled = true;

  // Группа мышц
  form.createEl('label', { text: 'Группа мышц:' });
  const groupSelect = form.createEl('select', { cls: 'workout-input' });
  groupSelect.createEl('option', { value: '', text: 'Выберите группу...' });
  ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс', 'Кардио', 'Другое'].forEach(group => {
    groupSelect.createEl('option', { value: group, text: group });
  });

  // Описание
  form.createEl('label', { text: 'Описание (необязательно):' });
  const descInput = form.createEl('textarea', {
    placeholder: 'Краткое описание упражнения...',
    cls: 'workout-input workout-textarea'
  });



  // Кнопки
  const buttons = form.createDiv({ cls: 'workout-form-buttons' });

  const saveBtn = buttons.createEl('button', {
    text: 'Создать упражнение',
    cls: 'workout-btn workout-btn-primary'
  });

  const cancelBtn = buttons.createEl('button', {
    text: 'Отмена',
    cls: 'workout-btn'
  });

  saveBtn.addEventListener('click', async () => {
    if (!groupSelect.value) {
      new Notice('Выберите группу мышц');
      return;
    }


    const exerciseSpec = {
      group: groupSelect.value,
      description: descInput.value.trim() || undefined,
      muscleGroups: [groupSelect.value],
      difficulty: 'начинающий' as const
    };

    try {
      await plugin.dataManager.addExercise(exerciseName, exerciseSpec);
      await plugin.dataManager.loadExerciseLibrary();

      // Do not auto-fill 1RM when adding an exercise to the library (library entry is metadata only)

      hideModal(modal);
      new Notice(`Упражнение "${exerciseName}" добавлено в библиотеку`);
    } catch (error) {
      console.error('Ошибка при создании упражнения:', error);
      new Notice('Ошибка при создании упражнения');
    }
  });

  cancelBtn.addEventListener('click', () => {
    hideModal(modal);
  });
}
