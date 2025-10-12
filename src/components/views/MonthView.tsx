import React from 'react';
import { WorkoutData, ExerciseLibrary } from '../../types';

interface MonthViewProps {
  workoutData: WorkoutData;
  exerciseLibrary: ExerciseLibrary;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onDataChange: (data: WorkoutData) => void;
  onExerciseLibraryChange: (library: ExerciseLibrary) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({ workoutData }) => {
  return (
    <div className="workout-month-view">
      <h3>Месяц</h3>
      <p>Количество тренировок: {Object.keys(workoutData).length}</p>
      <div className="month-placeholder">
        <p>Календарь месяца будет здесь</p>
      </div>
    </div>
  );
};