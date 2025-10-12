import React from 'react';
import { ViewType } from '../../types';

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange }) => {
  const views: { id: ViewType; label: string }[] = [
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
    { id: 'year', label: 'Год' },
    { id: 'progress', label: 'Прогресс' },
    { id: 'spec', label: 'Упражнения' }
  ];

  return (
    <div className="workout-view-switcher">
      {views.map((view) => (
        <button
          key={view.id}
          className={`workout-view-button ${currentView === view.id ? 'active' : ''}`}
          onClick={() => onViewChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
};