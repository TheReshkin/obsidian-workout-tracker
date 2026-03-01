import { WorkoutData, WorkoutEntry, MUSCLE_GROUP_COLORS } from '../../types';
import { applyLuminanceColor } from '../../utils/dom-helpers';

interface WorkoutStats {
  general: Record<string, number>;
  byMuscleGroup: Record<string, number>;
}

const STAT_LABELS: Record<string, string> = {
  total: 'Всего тренировок',
  done: 'Выполнено',
  planned: 'Запланировано',
  skipped: 'Пропущено',
  illness: 'Болезнь',
};

/**
 * Подсчитывает статистику по тренировочным данным.
 */
export function calculateStats(workoutData: WorkoutData): WorkoutStats {
  const stats: WorkoutStats = {
    general: { total: 0, done: 0, planned: 0, skipped: 0, illness: 0 },
    byMuscleGroup: {},
  };

  Object.values(workoutData).forEach((workout) => {
    stats.general.total++;
    if (stats.general[workout.status] !== undefined) {
      stats.general[workout.status]++;
    }

    const type = workout.type || 'другое';
    stats.byMuscleGroup[type] = (stats.byMuscleGroup[type] || 0) + 1;
  });

  return stats;
}

/**
 * Рендерит вид «Статистика» в указанный контейнер.
 */
export function renderStatsView(
  container: HTMLElement,
  workoutData: WorkoutData
): void {
  container.addClass('workout-stats-view');

  const stats = calculateStats(workoutData);

  // Общая статистика
  const generalStats = container.createDiv({ cls: 'workout-general-stats' });
  generalStats.createEl('h4', { text: 'Общая статистика' });

  const statsGrid = generalStats.createDiv({ cls: 'stats-grid' });

  Object.entries(stats.general).forEach(([key, value]) => {
    const statItem = statsGrid.createDiv({ cls: 'stat-item' });
    statItem.createSpan({ text: STAT_LABELS[key] || key, cls: 'stat-label' });
    statItem.createSpan({ text: value.toString(), cls: 'stat-value' });
  });

  // По группам мышц
  if (Object.keys(stats.byMuscleGroup).length > 0) {
    const muscleStats = container.createDiv({ cls: 'workout-muscle-stats' });
    muscleStats.createEl('h4', { text: 'По группам мышц' });

    Object.entries(stats.byMuscleGroup).forEach(([group, count]) => {
      const groupItem = muscleStats.createDiv({ cls: 'muscle-group-item' });
      const span = groupItem.createSpan({ text: group, cls: 'group-name pill' });

      const bg = MUSCLE_GROUP_COLORS[group];
      if (bg) {
        applyLuminanceColor(span, bg);
      }

      groupItem.createSpan({ text: count.toString(), cls: 'group-count' });
    });
  }

  // --- Progress charts ---
  const chartsSection = container.createDiv({ cls: 'workout-progress-charts' });
  chartsSection.createEl('h4', { text: 'Прогресс по упражнениям' });

  // Controls: exercise selector and metric
  const controls = chartsSection.createDiv({ cls: 'charts-controls' });
  controls.createEl('label', { text: 'Упражнение:' });
  const exerciseSelect = controls.createEl('select', { cls: 'workout-input' }) as HTMLSelectElement;

  controls.createEl('label', { text: 'Метрика:' });
  const metricSelect = controls.createEl('select', { cls: 'workout-input' }) as HTMLSelectElement;
  metricSelect.createEl('option', { value: 'oneRM', text: '1ПМ (оценка)' });
  metricSelect.createEl('option', { value: 'maxWeight', text: 'Макс вес' });

  // Period selector (zoom)
  controls.createEl('label', { text: 'Период:' });
  const periodSelect = controls.createEl('select', { cls: 'workout-input' }) as HTMLSelectElement;
  periodSelect.createEl('option', { value: 'all', text: 'Все' });
  periodSelect.createEl('option', { value: '3', text: 'Последние 3' });
  periodSelect.createEl('option', { value: '6', text: 'Последние 6' });
  periodSelect.createEl('option', { value: '12', text: 'Последние 12' });

  // Chart container
  const chartContainer = chartsSection.createDiv({ cls: 'chart-container' });

  // Build list of unique exercise names from workoutData
  const exerciseNames = new Set<string>();
  Object.entries(workoutData).forEach(([date, w]) => {
    if (!w.exercises) return;
    w.exercises.forEach(e => exerciseNames.add(e.name));
  });

  // populate select
  Array.from(exerciseNames).sort().forEach(n => exerciseSelect.createEl('option', { value: n, text: n }));

  // Helper: build timeseries for a given exercise name
  function buildSeriesForExercise(name: string) {
    const points: { date: string; oneRM?: number; maxWeight?: number }[] = [];
    Object.entries(workoutData).forEach(([date, w]) => {
      if (!w.exercises) return;
      const matches = w.exercises.filter(e => e.name === name);
      if (!matches || !matches.length) return;
      // find best set across all occurrences in this workout entry
      let bestOneRM = 0;
      let bestWeight = 0;
      matches.forEach(m => {
        m.sets?.forEach(s => {
          const wVal = s.weight || 0;
          const r = s.reps || 0;
          if (wVal > bestWeight) bestWeight = wVal;
          if (wVal > 0 && r > 0) {
            const est = Math.round(wVal * (1 + r / 30));
            if (est > bestOneRM) bestOneRM = est;
          }
        });
      });
      if (bestOneRM > 0 || bestWeight > 0) {
        points.push({ date, oneRM: bestOneRM || undefined, maxWeight: bestWeight || undefined });
      }
    });
    // sort by date ascending
    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  }

  // Simple SVG line chart renderer with points and clickable markers
  function renderLineChart(target: HTMLElement, points: { x: string; y: number }[], color: string, label: string) {
    target.empty();
    if (!points || points.length === 0) {
      target.createEl('div', { text: 'Нет данных для выбранного упражнения.' });
      return;
    }
    const w = 700;
    const h = 300;
    const pad = 40;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGElement;
    svg.setAttribute('class', 'progress-chart');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    const vals = points.map(p => p.y);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;

    // coordinates
    const coordsArr = points.map((p, i) => {
      const x = pad + (i / (points.length - 1 || 1)) * (w - pad * 2);
      const y = h - pad - ((p.y - min) / range) * (h - pad * 2);
      return { x, y, date: p.x, value: p.y };
    });

    const coords = coordsArr.map(c => `${c.x},${c.y}`).join(' ');

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', coords);
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', color);
    poly.setAttribute('stroke-width', '2');
    svg.appendChild(poly);

    // draw grid lines and y labels (3 steps)
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (let i = 0; i <= 4; i++) {
      const y = pad + (i / 4) * (h - pad * 2);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(pad));
      line.setAttribute('x2', String(w - pad));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      line.setAttribute('stroke', 'rgba(0,0,0,0.06)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
      const val = Math.round(max - (i / 4) * (range));
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(8));
      label.setAttribute('y', String(y + 4));
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', 'currentColor');
      label.textContent = String(val);
      svg.appendChild(label);
    }

    // x labels (show up to 6 labels)
    const maxLabels = 6;
    const step = Math.max(1, Math.ceil(points.length / maxLabels));
    coordsArr.forEach((c, i) => {
      if (i % step !== 0 && i !== coordsArr.length - 1) return;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(c.x));
      text.setAttribute('y', String(h - 8));
      text.setAttribute('font-size', '10');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', 'currentColor');
      // short date (YYYY-MM-DD -> MM-DD)
      const short = c.date.length >= 10 ? c.date.slice(5, 10) : c.date;
      text.textContent = short;
      svg.appendChild(text);
    });

    // points with hover title and click handler
    coordsArr.forEach(c => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(c.x));
      circle.setAttribute('cy', String(c.y));
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#fff');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '2');
      circle.style.cursor = 'pointer';
      // title for native tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${c.date}: ${c.value}`;
      circle.appendChild(title);
      circle.addEventListener('click', () => {
        // dispatch a custom event with date to allow other parts to react
        document.dispatchEvent(new CustomEvent('workout-open', { detail: { date: c.date } }));
      });
      svg.appendChild(circle);
    });

    target.appendChild(svg as unknown as Node);
  }

  // render handler
  function renderSelected() {
    const name = exerciseSelect.value;
    const metric = metricSelect.value;
    const raw = buildSeriesForExercise(name);
    let points = raw.map(r => ({ x: r.date, y: metric === 'oneRM' ? (r.oneRM || 0) : (r.maxWeight || 0) }))
      .filter(p => p.y > 0);
    // apply period filter
    const period = periodSelect.value;
    if (period !== 'all') {
      const n = parseInt(period, 10) || points.length;
      points = points.slice(Math.max(0, points.length - n));
    }
    // map to chart format
    const chartPoints = points.map(p => ({ x: p.x, y: p.y }));
    // choose color based on muscle group if possible
    const color = '#4E79A7';
    renderLineChart(chartContainer, chartPoints, color, `${name} — ${metric}`);
  }

  exerciseSelect.addEventListener('change', renderSelected);
  metricSelect.addEventListener('change', renderSelected);

  // auto-select first if present
  if (exerciseSelect.options.length > 0) {
    exerciseSelect.selectedIndex = 0;
    renderSelected();
  } else {
    chartContainer.createEl('div', { text: 'Нет упражнений в данных.' });
  }
}
