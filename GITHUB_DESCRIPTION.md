# 🏋️ Workout Tracker Plugin for Obsidian

**Comprehensive fitness tracking directly in your markdown notes**

Transform simple code blocks into interactive workout calendars with drag-and-drop functionality, exercise libraries, and progress tracking.

## ✨ Key Features

🗓️ **Interactive Calendar Views** - Week/Month/Year views with drag-and-drop workout management  
💪 **Smart Exercise Library** - 13+ pre-loaded exercises with autocomplete and custom exercise creation  
📊 **1RM Tracking** - One-rep maximum calculations with intensity percentages  
🎨 **Theme Compatible** - Works seamlessly with all Obsidian themes  
📱 **Mobile Friendly** - Responsive design for mobile devices  

## 🚀 Quick Start

1. Install plugin in `.obsidian/plugins/workout-tracker/`
2. Enable in Community Plugins settings
3. Run "Create Basic Exercise Library" command
4. Add a `workout` code block to any note

```workout
{
  "2024-10-12": {
    "type": "Strength",
    "status": "completed",
    "exercises": [
      {
        "name": "Bench Press", 
        "sets": [{"reps": 8, "weight": 80}]
      }
    ]
  }
}
```

**Boom!** Interactive calendar interface in your note 🎯

## 🛠️ Built With

TypeScript • Obsidian API • esbuild • CSS

---

Perfect for fitness enthusiasts who want to track workouts alongside their knowledge management in Obsidian!