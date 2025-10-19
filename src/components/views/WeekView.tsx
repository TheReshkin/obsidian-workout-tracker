import React from 'react';
import { WorkoutData, ExerciseLibrary } from '../../types';

interface WeekViewProps {
  workoutData: WorkoutData;
  exerciseLibrary: ExerciseLibrary;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onDataChange: (data: WorkoutData) => void;
  onExerciseLibraryChange: (library: ExerciseLibrary) => void;
  plugin?: any;
}

export const WeekView: React.FC<WeekViewProps> = ({ 
  workoutData, 
  selectedDate, 
  onDateChange, 
  plugin
}) => {
  return (
    <div className="workout-week-view">
      <h3>Неделя</h3>
      <p>Выбранная дата: {selectedDate}</p>
      <p>Количество тренировок: {Object.keys(workoutData).length}</p>
      
      {/* Временная заглушка */}
      <div className="week-placeholder">
        <p>Вид недели будет здесь</p>
        <ul>
          {Object.entries(workoutData).slice(0, 5).map(([date, workout]) => (
            <li key={date} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ flex: 1 }}>{date}: {workout.type} ({workout.status})</span>
              <button className="workout-btn" onClick={() => (plugin as any).openSingleDayView && (plugin as any).openSingleDayView(date)}>Один день</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};