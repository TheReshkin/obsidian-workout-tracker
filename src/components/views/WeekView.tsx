import React from 'react';
import { WorkoutData, ExerciseLibrary } from '../../types';

interface WeekViewProps {
  workoutData: WorkoutData;
  exerciseLibrary: ExerciseLibrary;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onDataChange: (data: WorkoutData) => void;
  onExerciseLibraryChange: (library: ExerciseLibrary) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({ 
  workoutData, 
  selectedDate, 
  onDateChange 
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
            <li key={date}>
              {date}: {workout.type} ({workout.status})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};