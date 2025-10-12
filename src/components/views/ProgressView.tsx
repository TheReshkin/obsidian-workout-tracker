import React from 'react';
import { WorkoutData, ExerciseLibrary } from '../../types';

interface ProgressViewProps {
  workoutData: WorkoutData;
  exerciseLibrary: ExerciseLibrary;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onDataChange: (data: WorkoutData) => void;
  onExerciseLibraryChange: (library: ExerciseLibrary) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ workoutData }) => {
  return (
    <div className="workout-progress-view">
      <h3>Прогресс</h3>
      <p>Количество тренировок: {Object.keys(workoutData).length}</p>
      <div className="progress-placeholder">
        <p>Графики прогресса будут здесь</p>
      </div>
    </div>
  );
};