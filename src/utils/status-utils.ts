import { WorkoutStatus, STATUS_COLORS } from "../types";

export function statusToClass(status?: WorkoutStatus): string {
  switch (status) {
    case 'done': return 'status-done';
    case 'planned': return 'status-planned';
    case 'skipped': return 'status-skipped';
    case 'illness': return 'status-illness';
    default: return 'status-planned';
  }
}

export function statusToLabel(status?: WorkoutStatus): string {
  switch (status) {
    case 'done': return 'Выполнено';
    case 'planned': return 'Запланировано';
    case 'skipped': return 'Пропущено';
    case 'illness': return 'Болезнь';
    default: return 'Запланировано';
  }
}

export function nextStatus(status?: WorkoutStatus): WorkoutStatus {
  const order: WorkoutStatus[] = ['planned','done','skipped','illness'];
  const idx = status ? order.indexOf(status) : 0;
  return order[(idx + 1) % order.length];
}
