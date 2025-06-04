import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Calendar, Clock, Target, AlertCircle, Brain, Upload, Settings, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Sparkles, Zap } from 'lucide-react';
import { StudioraDualParser } from './services/StudioraDualParser';
// Import actual parsers
import { RegexDocumentParser } from './services/RegexDocumentParser.js';
import { StudiorAIService } from './services/StudiorAIService.js';


// Simple Calendar Component (since we can't use FullCalendar in the artifact)
const SimpleCalendar = ({ events, onEventClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 4, 1)); // May 2025
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };
  
  const formatMonth = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  
  const getEventsForDay = (day) => {
    if (!day) return [];
    const dayStr = day.toISOString().split('T')[0];
    return events.filter(e => e.date === dayStr);
  };
  
  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-semibold">{formatMonth(currentMonth)}</h3>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
              {day}
            </div>
          ))}
          
          {days.map((day, index) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            const isToday = day && day.toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={`min-h-[80px] p-1 border rounded ${
                  day ? 'hover:bg-gray-50' : ''
                } ${isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}
              >
                {day && (
                  <>
                    <div className="text-sm font-medium text-gray-700 mb-1">
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event, idx) => (
                        <div
                          key={idx}
                          onClick={() => onEventClick(event)}
                         className={`text-xs p-1 rounded cursor-pointer truncate ${
                          event.type === 'study-block' ? 'bg-black text-white' :
                          event.type === 'exam' ? 'bg-red-100 text-red-700' :
                          event.type === 'quiz' ? 'bg-yellow-100 text-yellow-700' :
                          event.type === 'clinical' ? 'bg-blue-100 text-blue-700' :
                          event.type === 'lab' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const formatAssignmentForDisplay = (assignment) => {
  const actionVerbs = {
    'reading': 'READ', 'video': 'WATCH', 'quiz': 'QUIZ', 'exam': 'TEST',
    'assignment': 'DO', 'discussion': 'DISCUSS', 'clinical': 'ATTEND',
    'simulation': 'PRACTICE', 'prep': 'STUDY', 'activity': 'COMPLETE', 'remediation': 'REVIEW'
  };

  const priorities = {
    'exam': 'HIGH', 'quiz': 'MEDIUM', 'clinical': 'HIGH', 'assignment': 'MEDIUM',
    'reading': 'LOW', 'video': 'LOW'
  };

  const actionVerb = actionVerbs[assignment.type] || 'DO';
  const priority = priorities[assignment.type] || 'MEDIUM';
  
  let cleanText = assignment.text
    .replace(/^(assignment|quiz|exam|reading|video|discussion)[\s:]+/i, '')
    .replace(/\s*\(due[^)]*\)/i, '').trim();

  return {
    ...assignment,
    actionVerb, priority, cleanText,
    displayTitle: `${actionVerb}: ${cleanText}`
  };
};

const getActionIcon = (actionVerb) => {
  const icons = {
    'READ': '📖', 'WATCH': '📺', 'QUIZ': '❓', 'TEST': '📝', 'DO': '✏️',
    'DISCUSS': '💬', 'ATTEND': '🏥', 'PRACTICE': '🎯', 'STUDY': '📚',
    'COMPLETE': '✅', 'REVIEW': '🔄'
  };
  return icons[actionVerb] || '📋';
};

const getPriorityColor = (priority) => {
  const colors = {
    'HIGH': 'bg-red-100 text-red-700 border-red-200',
    'MEDIUM': 'bg-yellow-100 text-yellow-700 border-yellow-200', 
    'LOW': 'bg-green-100 text-green-700 border-green-200'
  };
  return colors[priority] || colors['MEDIUM'];
};

// Adaptive Scheduler Class
class AdaptiveScheduler {
  constructor() {
    this.preferences = {
      dailyStudyHours: 4,
      weekendStudyHours: 6,
      daysBeforeDue: 3,
      complexAssignmentBuffer: 2,
      studySessionLength: 90,
      breakBetweenSessions: 15,
      blockedTimes: [
        { day: 'Saturday', startTime: '18:00', endTime: '23:59' },
        { day: 'Sunday', startTime: '10:00', endTime: '14:00' }
      ]
    };
  }

  generateStudyBlocks(assignments, existingEvents) {
    const studyBlocks = [];
    const fixedEvents = existingEvents.filter(e => e.fixed);
    const needsScheduling = assignments.filter(a => 
      !['exam', 'clinical', 'lab'].includes(a.type) && 
      new Date(a.date) >= new Date()
    );

    needsScheduling.sort((a, b) => {
      const aComplexity = this.calculateComplexity(a);
      const bComplexity = this.calculateComplexity(b);
      const aDaysUntilDue = this.daysUntilDue(a.date);
      const bDaysUntilDue = this.daysUntilDue(b.date);
      
      return (aComplexity * 10 - aDaysUntilDue) - (bComplexity * 10 - bDaysUntilDue);
    });

    needsScheduling.forEach(assignment => {
      const blocks = this.scheduleAssignment(assignment, fixedEvents, studyBlocks);
      studyBlocks.push(...blocks);
    });

    return studyBlocks;
  }

  calculateComplexity(assignment) {
    const complexTypes = ['project', 'simulation', 'assignment'];
    const isComplex = complexTypes.includes(assignment.type) || 
                     assignment.hours > 3 ||
                     assignment.text.toLowerCase().includes('final') ||
                     assignment.text.toLowerCase().includes('comprehensive');
    return isComplex ? 2 : 1;
  }

  scheduleAssignment(assignment, fixedEvents, existingBlocks) {
    const complexity = this.calculateComplexity(assignment);
    const daysNeeded = this.preferences.daysBeforeDue + 
                      (complexity > 1 ? this.preferences.complexAssignmentBuffer : 0);
    
    const dueDate = new Date(assignment.date);
    const startDate = new Date(dueDate);
    startDate.setDate(dueDate.getDate() - daysNeeded);

    const blocks = [];
    let remainingHours = assignment.hours;
    let currentDate = new Date(startDate);

    while (remainingHours > 0 && currentDate <= dueDate) {
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const maxHours = isWeekend ? this.preferences.weekendStudyHours : this.preferences.dailyStudyHours;
      
      const availableSlots = this.findAvailableSlots(currentDate, fixedEvents, existingBlocks);
      
      for (const slot of availableSlots) {
        if (remainingHours <= 0) break;
        
        const duration = Math.min(remainingHours, this.preferences.studySessionLength / 60);
        blocks.push({
          id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          assignmentId: assignment.id,
          title: `Study: ${assignment.displayTitle}`,
          date: currentDate.toISOString().split('T')[0],
          startTime: slot.startTime,
          duration: duration,
          type: 'study-block',
          course: assignment.course,
          priority: assignment.priority,
          assignment: assignment
        });
        
        remainingHours -= duration;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return blocks;
  }

  findAvailableSlots(date, fixedEvents, existingBlocks) {
    const slots = [];
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = fixedEvents.filter(e => e.date === dateStr);
    
    // Simple time slots - enhance this with actual collision detection
    const possibleSlots = [
      { startTime: '08:00', endTime: '10:00' },
      { startTime: '10:30', endTime: '12:30' },
      { startTime: '13:30', endTime: '15:30' },
      { startTime: '16:00', endTime: '18:00' },
      { startTime: '19:00', endTime: '21:00' }
    ];
    
    // Filter out slots that conflict with fixed events
    return possibleSlots.filter(slot => {
      return !dayEvents.some(event => {
        // Add collision detection logic here
        return false; // Placeholder
      });
    });
  }

  daysUntilDue(dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  }

  optimizeSchedule(studyBlocks) {
    return studyBlocks.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
  }
}

// Main App Component
function StudioraNursingPlanner() {
  const [assignments, setAssignments] = useState([]);
  const [completedAssignments, setCompletedAssignments] = useState(new Set());
  const [showParser, setShowParser] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [schedulerActive, setSchedulerActive] = useState(false);
  const [studyBlocks, setStudyBlocks] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [parsingResults, setParsingResults] = useState(null);
  const schedulerRef = useRef(new AdaptiveScheduler());

  // Course definitions
  const courses = {
    nclex: { name: 'NCLEX Immersion', color: 'purple', modules: [] },
    obgyn: { name: 'OB/GYN Nursing', color: 'blue', modules: [] },
    adulthealth: { name: 'Adult Health', color: 'green', modules: [] },
    geronto: { name: 'Gerontology', color: 'orange', modules: [] }
  };

  // Load saved data
  useEffect(() => {
    const saved = localStorage.getItem('studiora_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const formattedAssignments = (data.assignments || []).map(formatAssignmentForDisplay);
        setAssignments(formattedAssignments);
        setCompletedAssignments(new Set(data.completed || []));
        setStudyBlocks(data.studyBlocks || []);
        setParsingResults(data.parsingResults || null);
      } catch (e) {
        console.warn('Failed to load saved data:', e);
      }
    }
  }, []);

  // Save data when it changes
  useEffect(() => {
    const data = {
      assignments,
      completed: Array.from(completedAssignments),
      studyBlocks,
      parsingResults,
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('studiora_data', JSON.stringify(data));
  }, [assignments, completedAssignments, studyBlocks, parsingResults]);

  // Update calendar events when assignments or study blocks change
  useEffect(() => {
  // Only show fixed events on calendar (exams, classes, clinical)
  const fixedEvents = assignments
    .filter(a => ['exam', 'clinical', 'lab'].includes(a.type))
    .map(a => ({
      id: a.id,
      title: a.displayTitle,
      date: a.date,
      type: a.type,
      course: a.course,
      priority: a.priority,
      fixed: true
    }));
  
  const blockEvents = studyBlocks.map(b => ({
    id: b.id,
    title: b.title,
    date: b.date,
    type: 'study-block',
    course: b.course,
    priority: b.priority,
    startTime: b.startTime,
    duration: b.duration,
    color: 'black'
  }));
  
  setCalendarEvents([...fixedEvents, ...blockEvents]);
}, [assignments, studyBlocks]);

  const handleParseComplete = (results) => {
    const formattedAssignments = results.assignments.map(formatAssignmentForDisplay);
    setAssignments(formattedAssignments);
    setParsingResults(results);
    setShowParser(false);
  };

  const toggleAssignment = (assignmentId) => {
    const newCompleted = new Set(completedAssignments);
    if (newCompleted.has(assignmentId)) {
      newCompleted.delete(assignmentId);
    } else {
      newCompleted.add(assignmentId);
    }
    setCompletedAssignments(newCompleted);
  };

  const generateStudySchedule = () => {
    setSchedulerActive(true);
    
    const incompleteAssignments = assignments.filter(a => 
      !completedAssignments.has(a.id)
    );

    const blocks = schedulerRef.current.generateStudyBlocks(incompleteAssignments, calendarEvents);
    const optimizedBlocks = schedulerRef.current.optimizeSchedule(blocks);
    
    setStudyBlocks(optimizedBlocks);
  };

  const clearStudyBlocks = () => {
    setStudyBlocks([]);
    setSchedulerActive(false);
  };

  const handleEventClick = (event) => {
    alert(`${event.title}\n${event.date}\nType: ${event.type}\nPriority: ${event.priority || 'N/A'}`);
  };

  const filteredAssignments = selectedCourse === 'all' 
    ? assignments 
    : assignments.filter(a => a.course === selectedCourse);

  const assignmentsByCourse = Object.keys(courses).reduce((acc, courseKey) => {
    acc[courseKey] = assignments.filter(a => a.course === courseKey);
    return acc;
  }, {});

  const stats = {
    total: filteredAssignments.length,
    completed: filteredAssignments.filter(a => completedAssignments.has(a.id)).length,
    totalHours: filteredAssignments.reduce((sum, a) => sum + (a.hours || 0), 0),
    dueThisWeek: filteredAssignments.filter(a => {
      const dueDate = new Date(a.date);
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return dueDate <= weekFromNow && dueDate >= new Date() && !completedAssignments.has(a.id);
    }).length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-bold">Studiora</h1>
              <span className="text-sm text-gray-500">Nursing Schedule Planner</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <nav className="hidden md:flex space-x-2">
                {['dashboard', 'calendar', 'scheduler'].map(view => (
                  <button
                    key={view}
                    onClick={() => setCurrentView(view)}
                    className={`px-3 py-1 rounded text-sm capitalize ${
                      currentView === view ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </nav>
              <button
                onClick={() => setShowParser(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2"
              >
                <Upload size={16} />
                <span className="hidden sm:inline">Import</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Course Modules Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="font-semibold mb-4 flex items-center">
                  <BookOpen className="mr-2 h-5 w-5" />
                  Course Modules
                </h2>
                
                {Object.entries(assignmentsByCourse).map(([courseKey, courseAssignments]) => {
                  if (courseAssignments.length === 0) return null;
                  const course = courses[courseKey];
                  
                  return (
                    <CourseModuleCard
                      key={courseKey}
                      course={course}
                      courseKey={courseKey}
                      assignments={courseAssignments}
                      completedAssignments={completedAssignments}
                      onToggleAssignment={toggleAssignment}
                      isSelected={selectedCourse === courseKey}
                      onSelect={() => setSelectedCourse(courseKey)}
                    />
                  );
                })}
                
                <button
                  onClick={() => setSelectedCourse('all')}
                  className={`w-full mt-2 p-2 rounded text-sm ${
                    selectedCourse === 'all' ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  View All Courses
                </button>
              </div>

              {parsingResults && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-medium mb-2 flex items-center">
                    <Zap className="mr-2 h-4 w-4" />
                    Parsing Results
                  </h3>
                  <div className="text-xs space-y-1">
                    <div>Method: {parsingResults.metadata?.method}</div>
                    <div>Confidence: {Math.round((parsingResults.metadata?.confidence || 0) * 100)}%</div>
                    <div className="text-gray-600">{parsingResults.metadata?.summary}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="Total Assignments"
                  value={stats.total}
                  subtitle={`${stats.completed} completed`}
                  icon={BookOpen}
                  color="blue"
                />
                <StatsCard
                  title="Study Hours"
                  value={stats.totalHours.toFixed(1)}
                  subtitle="Total estimated"
                  icon={Clock}
                  color="green"
                />
                <StatsCard
                  title="Due This Week"
                  value={stats.dueThisWeek}
                  subtitle="Upcoming"
                  icon={AlertCircle}
                  color="orange"
                />
              </div>

              {/* Assignment List */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-semibold">
                    {selectedCourse === 'all' ? 'All Assignments' : `${courses[selectedCourse]?.name} Assignments`}
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={generateStudySchedule}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
                    >
                      <Sparkles size={14} />
                      <span>Generate Schedule</span>
                    </button>
                  </div>
                </div>
                
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {filteredAssignments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
                      <p className="mt-2">No assignments found</p>
                      <button
                        onClick={() => setShowParser(true)}
                        className="mt-2 text-blue-600 hover:text-blue-800"
                      >
                        Import course data
                      </button>
                    </div>
                  ) : (
                    filteredAssignments
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map(assignment => (
                        <AssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          isCompleted={completedAssignments.has(assignment.id)}
                          onToggle={() => toggleAssignment(assignment.id)}
                        />
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {currentView === 'calendar' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Calendar View</h2>
              <div className="flex space-x-2">
                {schedulerActive && (
                  <button
                    onClick={clearStudyBlocks}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
                  >
                    <RotateCcw size={14} />
                    <span>Clear Study Blocks</span>
                  </button>
                )}
                <button
                  onClick={generateStudySchedule}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
                >
                  <Play size={14} />
                  <span>Generate Schedule</span>
                </button>
              </div>
            </div>
            
            <SimpleCalendar events={calendarEvents} onEventClick={handleEventClick} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Event Legend</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                    <span>Exams</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                    <span>Quizzes</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                    <span>Clinical/Labs</span>
                  </div>
                  <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-black rounded"></div>
                  <span>Study Blocks (Adaptive)</span>
                </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Study Statistics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Study Blocks:</span>
                    <span className="font-medium">{studyBlocks.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hours Scheduled:</span>
                    <span className="font-medium">
                      {studyBlocks.reduce((sum, b) => sum + b.duration, 0).toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Scheduler Status:</span>
                    <span className={`font-medium ${schedulerActive ? 'text-green-600' : 'text-gray-500'}`}>
                      {schedulerActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scheduler View */}
        {currentView === 'scheduler' && (
          <SchedulerView
            studyBlocks={studyBlocks}
            schedulerActive={schedulerActive}
            onGenerate={generateStudySchedule}
            onClear={clearStudyBlocks}
            assignments={assignments}
            completedAssignments={completedAssignments}
          />
        )}
      </div>

      {showParser && (
        <ParserModal onClose={() => setShowParser(false)} onComplete={handleParseComplete} />
      )}
    </div>
  );
}

// Component definitions
function CourseModuleCard({ course, courseKey, assignments, completedAssignments, onToggleAssignment, isSelected, onSelect }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const completed = assignments.filter(a => completedAssignments.has(a.id)).length;
  const progress = assignments.length > 0 ? (completed / assignments.length) * 100 : 0;

  const colorClasses = {
    purple: 'border-purple-200 bg-purple-50',
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    orange: 'border-orange-200 bg-orange-50'
  };

  const progressColors = {
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500'
  };

  return (
    <div className={`border-2 rounded-lg p-3 mb-3 cursor-pointer transition-all ${
      isSelected ? colorClasses[course.color] : 'border-gray-200 hover:border-gray-300'
    }`} onClick={onSelect}>
      
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-sm">{course.name}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-gray-400 hover:text-gray-600"
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>
      
      <div className="text-xs text-gray-600 mb-2">
        {completed}/{assignments.length} completed
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div 
          className={`h-2 rounded-full ${progressColors[course.color]}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
          {assignments.slice(0, 5).map(assignment => (
            <div key={assignment.id} className="flex items-center text-xs">
              <input
                type="checkbox"
                checked={completedAssignments.has(assignment.id)}
                onChange={(e) => { e.stopPropagation(); onToggleAssignment(assignment.id); }}
                className="mr-2 h-3 w-3"
                onClick={(e) => e.stopPropagation()}
              />
              <span className={completedAssignments.has(assignment.id) ? 'line-through text-gray-500' : ''}>
                {assignment.displayTitle}
              </span>
            </div>
          ))}
          {assignments.length > 5 && (
            <div className="text-xs text-gray-500">
              +{assignments.length - 5} more assignments
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignment, isCompleted, onToggle }) {
  const isOverdue = new Date(assignment.date) < new Date() && !isCompleted;
  const isDueSoon = !isOverdue && new Date(assignment.date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  return (
    <div className={`border rounded-lg p-3 transition-all ${
      isCompleted ? 'bg-gray-50 opacity-75' : 
      isOverdue ? 'bg-red-50 border-red-200' :
      isDueSoon ? 'bg-yellow-50 border-yellow-200' :
      'bg-white hover:shadow-md'
    }`}>
      
      <div className="flex items-start space-x-3">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={onToggle}
          className="mt-1 h-4 w-4 text-blue-600 rounded"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-lg">{getActionIcon(assignment.actionVerb)}</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(assignment.priority)}`}>
              {assignment.priority}
            </span>
            <span className="text-xs text-gray-500">
              {assignment.course?.toUpperCase()}
            </span>
          </div>
          
          <h4 className={`font-medium text-sm ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
            {assignment.displayTitle}
          </h4>
          
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
              {isOverdue ? 'OVERDUE - ' : ''}
              Due: {new Date(assignment.date).toLocaleDateString()}
            </span>
            <span>{assignment.hours}h</span>
            {assignment.confidence && (
              <span>{Math.round(assignment.confidence * 100)}% confidence</span>
            )}
          </div>
          
          {assignment.source && (
            <div className="mt-1">
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                assignment.source.includes('ai') ? 'bg-purple-100 text-purple-700' :
                assignment.source.includes('reconciled') ? 'bg-green-100 text-green-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {assignment.source}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, subtitle, icon: Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600', 
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-3">
          <p className="text-xl font-semibold text-gray-900">{value}</p>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function SchedulerView({ studyBlocks, schedulerActive, onGenerate, onClear, assignments, completedAssignments }) {
  const incompleteAssignments = assignments.filter(a => !completedAssignments.has(a.id));
  const highPriorityCount = incompleteAssignments.filter(a => a.priority === 'HIGH').length;
  const mediumPriorityCount = incompleteAssignments.filter(a => a.priority === 'MEDIUM').length;
  const lowPriorityCount = incompleteAssignments.filter(a => a.priority === 'LOW').length;

  return (
    <div className="space-y-6">
      {/* Scheduler Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Dynamic Study Scheduler</h2>
          <div className="flex space-x-2">
            <button
              onClick={onGenerate}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Play size={16} />
              <span>Generate Schedule</span>
            </button>
            {studyBlocks.length > 0 && (
              <button
                onClick={onClear}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <RotateCcw size={16} />
                <span>Clear Schedule</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="font-medium text-red-700">High Priority</h3>
            <p className="text-2xl font-bold text-red-900">{highPriorityCount}</p>
            <p className="text-sm text-red-600">Assignments</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium text-yellow-700">Medium Priority</h3>
            <p className="text-2xl font-bold text-yellow-900">{mediumPriorityCount}</p>
            <p className="text-sm text-yellow-600">Assignments</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-700">Low Priority</h3>
            <p className="text-2xl font-bold text-green-900">{lowPriorityCount}</p>
            <p className="text-sm text-green-600">Assignments</p>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="font-medium mb-2">Scheduler Status</h3>
          <div className={`p-2 rounded flex items-center space-x-2 ${
            schedulerActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {schedulerActive ? <Play size={16} /> : <Pause size={16} />}
            <span>{schedulerActive ? 'Active - Study blocks generated' : 'Inactive - Click Generate Schedule to start'}</span>
          </div>
        </div>
      </div>

      {/* Study Blocks */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Generated Study Blocks</h3>
        
        {studyBlocks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4">No study schedule generated yet</p>
            <p className="text-sm">Click "Generate Schedule" to create your adaptive study plan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {studyBlocks.map(block => (
              <div key={block.id} className="border rounded-lg p-4 flex justify-between items-center hover:bg-gray-50">
                <div className="flex-1">
                  <h4 className="font-medium flex items-center space-x-2">
                    <span>{getActionIcon(block.assignment?.actionVerb || 'STUDY')}</span>
                    <span>{block.title}</span>
                  </h4>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                    <span>{new Date(block.date).toLocaleDateString()}</span>
                    <span>{block.startTime}</span>
                    <span>{block.duration}h</span>
                    <span className="uppercase text-xs">{block.course}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(block.priority)}`}>
                    {block.priority}
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    Scheduled
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParserModal({ onClose, onComplete }) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState([]);

  const handleParse = async () => {
    if (!text.trim()) {
      setError('Please paste your nursing course data');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setProgress([]);
    setStatus('Initializing StudioraDualParser...');
    
    try {
      // In the real app, use the actual API key
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      setError('OpenAI API key not found. Please check your .env.local file.');
      return;
    }
    const parser = new StudioraDualParser(apiKey);
      
      const results = await parser.parse(text, 'auto', (progressUpdate) => {
        setStatus(progressUpdate.message || 'Processing...');
        setProgress(prev => [...prev, {
          stage: progressUpdate.stage,
          message: progressUpdate.message,
          timestamp: new Date().toLocaleTimeString()
        }]);
      });
      
      setStatus(`✅ SUCCESS: ${results.assignments.length} assignments found`);
      setTimeout(() => onComplete(results), 1500);
      
    } catch (error) {
      setError(`❌ Parsing failed: ${error.message}`);
      setStatus('Parsing failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold flex items-center">
                <Brain className="mr-2 h-6 w-6 text-blue-600" />
                StudioraDualParser
              </h2>
              <p className="text-sm text-gray-600">
                Paste your nursing course database to parse assignments
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-2">Input</h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your nursing course database here..."
              className="w-full h-64 p-3 border rounded-lg text-sm font-mono resize-none"
              disabled={isLoading}
            />
            <div className="text-xs text-gray-500 mt-1">
              {text.length} characters
            </div>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Progress</h3>
            <div className="h-64 border rounded-lg p-3 overflow-y-auto bg-gray-50 text-xs font-mono">
              {progress.length === 0 ? (
                <p className="text-gray-500">Progress will appear here...</p>
              ) : (
                progress.map((item, idx) => (
                  <div key={idx} className="mb-1">
                    <span className="text-gray-500">[{item.timestamp}]</span>
                    <span className={`ml-2 ${
                      item.stage === 'error' ? 'text-red-600' :
                      item.stage === 'complete' ? 'text-green-600' :
                      'text-blue-600'
                    }`}>
                      {item.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="px-6 pb-4">
          {status && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              status.includes('SUCCESS') ? 'bg-green-50 text-green-800' :
              status.includes('failed') ? 'bg-red-50 text-red-800' :
              'bg-blue-50 text-blue-800'
            }`}>
              {status}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            disabled={!text.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Parsing...</span>
              </>
            ) : (
              <>
                <Brain size={16} />
                <span>Parse with Studiora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudioraNursingPlanner;