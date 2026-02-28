/**
 * Общие DOM-хелперы для модальных окон и стилизации.
 * Используются в InlineWorkoutEditor и ExerciseLibraryManager.
 */

/**
 * Создаёт полноэкранное модальное окно с backdrop и ESC-закрытием.
 * Возвращает `content` — контейнер, в который нужно рендерить содержимое.
 * `content.modalContainer` ссылается на корневой overlay для удаления.
 */
export function createFullscreenModal(onClose?: () => void): HTMLElement {
  const modal = document.body.createDiv({ cls: 'workout-fullscreen-modal' });

  const close = () => {
    modal.remove();
    document.removeEventListener('keydown', escapeHandler);
    onClose?.();
  };

  // Backdrop click → close
  const backdrop = modal.createDiv({ cls: 'workout-modal-backdrop' });
  backdrop.addEventListener('click', close);

  // Content container
  const content = modal.createDiv({ cls: 'workout-modal-content' });

  // ESC → close (cleaned up on any close path)
  const escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', escapeHandler);

  // Store reference for hideModal()
  (content as any).modalContainer = modal;

  return content;
}

/**
 * Удаляет модальное окно, корректно находя корневой overlay
 * независимо от того, передан `content` или сам overlay.
 */
export function hideModal(modal: HTMLElement): void {
  const modalContainer =
    (modal as any).modalContainer ||
    modal.closest('.workout-fullscreen-modal') ||
    modal;
  modalContainer.remove();
}

/**
 * Применяет фоновый цвет к элементу и подбирает читаемый цвет текста
 * на основе luminance. Используется для пилюль групп мышц и категорий.
 *
 * @param element  — HTML-элемент (span/div)
 * @param bg       — HEX-цвет фона (#RRGGBB)
 */
export function applyLuminanceColor(element: HTMLElement, bg: string): void {
  if (!bg) return;

  element.style.background = bg;
  const hex = bg.replace('#', '');
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    element.style.color = luminance > 0.6 ? 'var(--text-normal)' : 'var(--text-on-accent)';
  }
}
