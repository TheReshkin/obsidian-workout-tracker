import React, { useState, useEffect } from 'react';
import { ViewType, WorkoutData, ExerciseLibrary } from '../types';
import { WeekView } from './views/WeekView';
import { MonthView } from './views/MonthView';
import { YearView } from './views/YearView';
import { ProgressView } from './views/ProgressView';
import { SpecView } from './views/SpecView';
import { ViewSwitcher } from './ui/ViewSwitcher';
import WorkoutTrackerPlugin from '../main';

interface WorkoutTrackerAppProps {
  plugin: WorkoutTrackerPlugin;
}

export const WorkoutTrackerApp: React.FC<WorkoutTrackerAppProps> = ({ plugin }) => {
  const [currentView, setCurrentView] = useState<ViewType>('week');
  const [workoutData, setWorkoutData] = useState<WorkoutData>({});
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({ exercises: {} });
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  // Загрузка данных при монтировании
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [workouts, exercises] = await Promise.all([
        plugin.dataManager.loadWorkoutData(),
        plugin.dataManager.loadExerciseLibrary()
      ]);
      setWorkoutData(workouts);
      setExerciseLibrary(exercises);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = async (newData: WorkoutData) => {
    setWorkoutData(newData);
    await plugin.dataManager.saveWorkoutData(newData);
  };

  const handleExerciseLibraryChange = async (newLibrary: ExerciseLibrary) => {
    setExerciseLibrary(newLibrary);
    await plugin.dataManager.saveExerciseLibrary(newLibrary);
  };

  const handleCreateNewFile = () => {
    plugin.createNewWorkoutFile();
  };

  const handleCreateTemplate = () => {
    plugin.createWorkoutTemplate();
  };

  const handleQuickAddWorkout = () => {
    plugin.quickAddWorkout();
  };

  if (loading) {
    return (
      <div className="workout-tracker-loading">
        <div>Загрузка данных тренировок...</div>
      </div>
    );
  }

  const renderCurrentView = () => {
    const commonProps = {
      workoutData,
      exerciseLibrary,
      selectedDate,
      onDateChange: setSelectedDate,
      onDataChange: handleDataChange,
      onExerciseLibraryChange: handleExerciseLibraryChange
    };

    switch (currentView) {
      case 'week':
        return <WeekView {...commonProps} plugin={plugin} />;
      case 'month':
        return <MonthView {...commonProps} />;
      case 'year':
        return <YearView {...commonProps} />;
      case 'progress':
        return <ProgressView {...commonProps} />;
      case 'spec':
        return <SpecView {...commonProps} />;
      default:
        return <WeekView {...commonProps} plugin={plugin} />;
    }
  };

  return (
    <div className="workout-tracker-app">
      <div className="workout-tracker-header">
        <h2>Workout Tracker</h2>
        <div className="workout-header-actions">
          <ViewSwitcher 
            currentView={currentView}
            onViewChange={setCurrentView}
          />
          <div className="workout-action-buttons">
            <button 
              className="workout-action-btn workout-btn-primary"
              onClick={handleQuickAddWorkout}
              title="Быстро добавить тренировку"
            >
              ➕ Тренировка
            </button>
            <button
              className="workout-action-btn"
              onClick={() => (plugin as any).openSingleDayView && (plugin as any).openSingleDayView(selectedDate)}
              title="Открыть однодневный вид"
            >
              🗓️ Один день
            </button>
            <button 
              className="workout-action-btn"
              onClick={handleCreateNewFile}
              title="Создать новый файл тренировок"
            >
              📁 Новый файл
            </button>
            <button 
              className="workout-action-btn"
              onClick={handleCreateTemplate}
              title="Создать шаблон тренировки"
            >
              📋 Шаблон
            </button>
          </div>
        </div>
      </div>
      
      <div className="workout-tracker-content">
        {renderCurrentView()}
      </div>
    </div>
  );
};