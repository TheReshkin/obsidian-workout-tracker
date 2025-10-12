import React from 'react';
import { WorkoutData, ExerciseLibrary } from '../../types';

interface SpecViewProps {
  workoutData: WorkoutData;
  exerciseLibrary: ExerciseLibrary;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onDataChange: (data: WorkoutData) => void;
  onExerciseLibraryChange: (library: ExerciseLibrary) => void;
}

export const SpecView: React.FC<SpecViewProps> = ({ exerciseLibrary }) => {
  return (
    <div className="workout-spec-view">
      <h3>Библиотека упражнений</h3>
      <p>Количество упражнений: {Object.keys(exerciseLibrary).length}</p>
      <div className="spec-placeholder">
        <p>Справочник упражнений будет здесь</p>
        <ul>
          {Object.entries(exerciseLibrary).slice(0, 10).map(([name, spec]) => (
            <li key={name}>
              {name} - {spec.group}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};