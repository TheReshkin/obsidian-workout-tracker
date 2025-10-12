import React from 'react';
import { WorkoutData, ExerciseLibrary } from '../../types';

interface YearViewProps {
  workoutData: WorkoutData;
  exerciseLibrary: ExerciseLibrary;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onDataChange: (data: WorkoutData) => void;
  onExerciseLibraryChange: (library: ExerciseLibrary) => void;
}

export const YearView: React.FC<YearViewProps> = ({ workoutData }) => {
  return (
    <div className="workout-year-view">
      <h3>Год</h3>
      <p>Количество тренировок: {Object.keys(workoutData).length}</p>
      <div className="year-placeholder">
        <p>Статистика за год будет здесь</p>
      </div>
    </div>
  );
};