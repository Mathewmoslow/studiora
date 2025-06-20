// StudyScheduler.jsx - Dynamic study block generation for Studiora
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Brain,
  Clock,
  Play,
  Trash2,
  AlertCircle,
  Calendar,
  Settings
} from 'lucide-react';
import { format, addDays, startOfDay, isBefore, isAfter, isWeekend } from 'date-fns';

export function StudyScheduler({ 
  assignments, 
  existingEvents, 
  courses, 
  onGenerateSchedule,
  onClearSchedule,
  completedAssignments = new Set() 
}) {
  const [preferences, setPreferences] = useState({
    dailyMax: 6,
    weekendMax: 4,
    blockDuration: 1.5,
    bufferDays: 3
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Filter incomplete assignments and calculate study needs
  const studyNeeds = useMemo(() => {
    const today = startOfDay(new Date());
    
    return assignments
      .filter(a => !completedAssignments.has(a.id) && new Date(a.date) > today)
      .map(assignment => {
        const dueDate = new Date(assignment.date);
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        const priority = getPriority(assignment.type);
        const urgencyScore = priority / Math.max(1, daysUntilDue);
        
        return {
          ...assignment,
          daysUntilDue,
          priority,
          urgencyScore,
          hoursNeeded: assignment.hours || estimateHours(assignment.type)
        };
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [assignments, completedAssignments]);

  // Calculate total hours needed
  const totalHoursNeeded = useMemo(() => {
    return studyNeeds.reduce((sum, need) => sum + need.hoursNeeded, 0);
  }, [studyNeeds]);

  // Get priority for assignment type
  function getPriority(type) {
    const priorities = {
      exam: 3,
      clinical: 3,
      paper: 2.5,
      quiz: 2,
      vsim: 2,
      assignment: 1.5,
      lab: 1.5,
      remediation: 1,
      reading: 1,
      video: 0.5,
      activity: 0.5
    };
    return priorities[type] || 1;
  }

  // Estimate hours for assignment type
  function estimateHours(type) {
    const estimates = {
      exam: 3,
      clinical: 8,
      paper: 5,
      quiz: 1.5,
      vsim: 2,
      assignment: 2,
      lab: 3,
      remediation: 2,
      reading: 2,
      video: 1,
      activity: 1
    };
    return estimates[type] || 2;
  }

  // Generate study blocks
  const generateStudyBlocks = () => {
    setIsGenerating(true);
    setSchedulerStatus('Generating study schedule...');
    
    const blocks = [];
    const today = startOfDay(new Date());
    
    // Track scheduled hours per day
    const scheduledHours = {};
    
    // Pre-calculate existing event hours per day
    existingEvents.forEach(event => {
      const dateKey = format(new Date(event.start), 'yyyy-MM-dd');
      if (!scheduledHours[dateKey]) scheduledHours[dateKey] = 0;
      
      const hours = (new Date(event.end) - new Date(event.start)) / (1000 * 60 * 60);
      scheduledHours[dateKey] += hours;
    });

    // Schedule each assignment
    studyNeeds.forEach(need => {
      const startDate = addDays(new Date(need.date), -preferences.bufferDays);
      const effectiveStartDate = isAfter(startDate, today) ? startDate : today;
      
      let hoursScheduled = 0;
      let currentDate = new Date(effectiveStartDate);
      
      while (hoursScheduled < need.hoursNeeded && isBefore(currentDate, need.date)) {
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const isWeekendDay = isWeekend(currentDate);
        const maxToday = isWeekendDay ? preferences.weekendMax : preferences.dailyMax;
        
        // Check existing hours for this day
        const existingHours = scheduledHours[dateKey] || 0;
        
        if (existingHours < maxToday) {
          const availableHours = maxToday - existingHours;
          const hoursToSchedule = Math.min(
            preferences.blockDuration,
            need.hoursNeeded - hoursScheduled,
            availableHours
          );
          
          if (hoursToSchedule > 0) {
            // Find a good time slot for this block
            const timeSlot = findTimeSlot(currentDate, hoursToSchedule, existingEvents, blocks);
            
            if (timeSlot) {
              const block = {
                id: `study_${need.id}_${blocks.length}`,
                assignmentId: need.id,
                courseId: need.courseId,
                title: `Study: ${need.text.substring(0, 50)}...`,
                start: timeSlot.start,
                end: timeSlot.end,
                type: 'study',
                hours: hoursToSchedule,
                assignment: need
              };
              
              blocks.push(block);
              hoursScheduled += hoursToSchedule;
              
              // Update scheduled hours
              if (!scheduledHours[dateKey]) scheduledHours[dateKey] = 0;
              scheduledHours[dateKey] += hoursToSchedule;
            }
          }
        }
        
        currentDate = addDays(currentDate, 1);
      }
    });
    
    setIsGenerating(false);
    setSchedulerStatus(`Generated ${blocks.length} study blocks`);
    
    // Pass the blocks to parent component
    onGenerateSchedule(blocks);
  };

  // Find available time slot for study block
  function findTimeSlot(date, hours, existingEvents, newBlocks) {
    const isWeekendDay = isWeekend(date);
    const dayStart = isWeekendDay ? 10 : 8; // Start later on weekends
    const dayEnd = 21; // End at 9 PM
    
    // Preferred study times
    const preferredSlots = [
      { start: 8, end: 12 },   // Morning
      { start: 13, end: 17 },  // Afternoon
      { start: 18, end: 21 }   // Evening
    ];
    
    // Try preferred slots first
    for (const slot of preferredSlots) {
      const start = new Date(date);
      start.setHours(slot.start, 0, 0, 0);
      
      const end = new Date(start);
      end.setHours(start.getHours() + hours);
      
      if (end.getHours() <= slot.end && !hasConflict(start, end, existingEvents, newBlocks)) {
        return { start, end };
      }
    }
    
    // If no preferred slot available, find any available slot
    for (let hour = dayStart; hour <= dayEnd - hours; hour += 0.5) {
      const start = new Date(date);
      start.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
      
      const end = new Date(start);
      end.setTime(start.getTime() + hours * 60 * 60 * 1000);
      
      if (!hasConflict(start, end, existingEvents, newBlocks)) {
        return { start, end };
      }
    }
    
    return null;
  }

  // Check for conflicts with existing events
  function hasConflict(start, end, existingEvents, newBlocks) {
    const allEvents = [...existingEvents, ...newBlocks];
    
    return allEvents.some(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      return (start < eventEnd && end > eventStart);
    });
  }

  // Clear all study blocks
  const handleClearSchedule = () => {
    onClearSchedule();
    setSchedulerStatus('Study blocks cleared');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-purple-600" />
          <h3 className="text-lg font-semibold dark:text-white">Adaptive Scheduler</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateStudyBlocks}
            disabled={isGenerating || studyNeeds.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Generate Study Schedule
              </>
            )}
          </button>
          <button
            onClick={handleClearSchedule}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Study Blocks
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="flex gap-6 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Daily Max (hrs)
          </label>
          <input
            type="number"
            value={preferences.dailyMax}
            onChange={(e) => setPreferences({ ...preferences, dailyMax: Number(e.target.value) })}
            min="1"
            max="12"
            className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-center"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Weekend Max (hrs)
          </label>
          <input
            type="number"
            value={preferences.weekendMax}
            onChange={(e) => setPreferences({ ...preferences, weekendMax: Number(e.target.value) })}
            min="1"
            max="8"
            className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-center"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Block Duration
          </label>
          <input
            type="number"
            value={preferences.blockDuration}
            onChange={(e) => setPreferences({ ...preferences, blockDuration: Number(e.target.value) })}
            min="0.5"
            max="3"
            step="0.5"
            className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-center"
          />
        </div>
      </div>

      {/* Status */}
      {schedulerStatus && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">{schedulerStatus}</p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{studyNeeds.length}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Pending Tasks</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{Math.ceil(totalHoursNeeded)}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Hours Needed</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {Math.ceil(totalHoursNeeded / preferences.dailyMax)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Days to Complete</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {studyNeeds.filter(n => n.daysUntilDue <= 3).length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Urgent Tasks</div>
        </div>
      </div>

      {/* Upcoming Priority Assignments */}
      {studyNeeds.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 dark:text-white">Priority Assignments</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {studyNeeds.slice(0, 5).map(need => {
              const course = courses.find(c => c.id === need.courseId);
              const urgencyColor = need.daysUntilDue <= 3 ? 'red' : 
                                 need.daysUntilDue <= 7 ? 'yellow' : 'green';
              
              return (
                <div key={need.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${urgencyColor}-500`} />
                    <span className="text-sm font-medium dark:text-white">
                      [{course?.code}] {need.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <span>{need.daysUntilDue} days</span>
                    <span>{need.hoursNeeded}h</span>
                    <span className={`px-2 py-1 rounded ${
                      need.type === 'exam' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      need.type === 'clinical' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                    }`}>
                      {need.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {studyNeeds.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No pending assignments to schedule!</p>
          <p className="text-sm">Great job staying on top of your work! 🎉</p>
        </div>
      )}
    </div>
  );
}

// Helper component for showing study blocks in calendar
export function StudyBlock({ block, onDelete }) {
  return (
    <div className="bg-purple-100 dark:bg-purple-900/20 border-l-3 border-purple-600 p-2 rounded text-sm group relative">
      <div className="font-medium text-purple-900 dark:text-purple-200">
        📚 {block.title}
      </div>
      <div className="text-xs text-purple-700 dark:text-purple-400">
        {format(new Date(block.start), 'h:mm a')} - {format(new Date(block.end), 'h:mm a')}
      </div>
      {block.assignment && (
        <div className="text-xs text-purple-600 dark:text-purple-500 mt-1">
          Due: {format(new Date(block.assignment.date), 'MMM d')}
        </div>
      )}
      <button
        onClick={() => onDelete(block.id)}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-3 w-3 text-red-500 hover:text-red-700" />
      </button>
    </div>
  );
}