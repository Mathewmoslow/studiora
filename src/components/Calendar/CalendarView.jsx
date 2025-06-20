// src/components/Calendar/CalendarView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, BookOpen, Brain, AlertCircle, RefreshCw, Plus, Edit2, Trash2, X, Save } from 'lucide-react';

function CalendarView({ course, assignments, studyBlocks: initialStudyBlocks = [], calendarEvents = [], onUpdateAssignment, onAddAssignment }) {
  const [currentView, setCurrentView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [studyBlocks, setStudyBlocks] = useState(initialStudyBlocks);
  const [manualEvents, setManualEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [preferences, setPreferences] = useState({
    dailyMax: 6,
    weekendMax: 4,
    blockDuration: 1.5,
    bufferDays: 3
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Today's date for highlighting
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Extract calendar events from assignments
  const extractedEvents = useMemo(() => {
    const events = [];
    
    assignments.forEach(assignment => {
      if (!assignment.date) return;
      
      const eventTypes = ['exam', 'clinical', 'lecture', 'quiz', 'test', 'lab', 'simulation', 'class', 'seminar'];
      const isEvent = eventTypes.some(type => 
        assignment.type === type || 
        assignment.text.toLowerCase().includes(type)
      );

      if (isEvent) {
        events.push({
          id: assignment.id,
          date: new Date(assignment.date),
          title: assignment.text,
          type: assignment.type === 'exam' || assignment.text.toLowerCase().includes('exam') ? 'exam' :
                assignment.type === 'clinical' || assignment.text.toLowerCase().includes('clinical') ? 'clinical' :
                assignment.type === 'lecture' || assignment.text.toLowerCase().includes('lecture') ? 'lecture' :
                'event',
          assignmentId: assignment.id,
          hours: assignment.hours,
          points: assignment.points,
          description: assignment.description || '',
          source: 'assignment'
        });
      }
    });
    
    return events;
  }, [assignments]);

  // Combine all events
  const allEvents = useMemo(() => {
    return [...extractedEvents, ...calendarEvents, ...studyBlocks, ...manualEvents];
  }, [extractedEvents, calendarEvents, studyBlocks, manualEvents]);

  // Generate study schedule algorithm
  const generateStudySchedule = () => {
    setIsGenerating(true);
    const newStudyBlocks = [];
    
    // Get all assignments including manual ones
    const allAssignments = [...assignments, ...manualEvents.filter(e => e.source === 'manual' && e.needsStudyTime)];
    
    // Filter assignments that need study time
    const studyAssignments = allAssignments.filter(assignment => {
      if (!assignment.date) return false;
      
      const isEvent = extractedEvents.some(e => e.assignmentId === assignment.id);
      if (isEvent && !assignment.needsStudyTime) return false;
      
      return assignment.type === 'reading' || 
             assignment.type === 'assignment' ||
             assignment.type === 'project' ||
             assignment.type === 'paper' ||
             assignment.type === 'homework' ||
             assignment.type === 'preparation' ||
             assignment.type === 'video' ||
             assignment.type === 'discussion' ||
             assignment.needsStudyTime ||
             (!['exam', 'clinical', 'lecture', 'quiz'].includes(assignment.type) && !isEvent);
    });

    // Sort by due date
    const sortedAssignments = [...studyAssignments].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    sortedAssignments.forEach(assignment => {
      const dueDate = new Date(assignment.date);
      const startDate = new Date(dueDate);
      startDate.setDate(startDate.getDate() - preferences.bufferDays);

      let hoursNeeded = assignment.hours || estimateHours(assignment);
      let currentDate = new Date(startDate);

      while (hoursNeeded > 0 && currentDate <= dueDate) {
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const maxToday = isWeekend ? preferences.weekendMax : preferences.dailyMax;

        // Check existing hours for this day
        const existingHours = newStudyBlocks
          .filter(b => b.date.toDateString() === currentDate.toDateString())
          .reduce((sum, b) => sum + b.hours, 0);

        if (existingHours < maxToday) {
          const hoursToSchedule = Math.min(
            preferences.blockDuration,
            hoursNeeded,
            maxToday - existingHours
          );

          newStudyBlocks.push({
            id: `study_${Date.now()}_${Math.random()}`,
            date: new Date(currentDate),
            title: `Study: ${assignment.text.substring(0, 30)}...`,
            fullTitle: assignment.text,
            type: 'study',
            hours: hoursToSchedule,
            assignmentId: assignment.id,
            courseCode: course.code,
            description: `Study block for: ${assignment.text}`,
            source: 'generated'
          });

          hoursNeeded -= hoursToSchedule;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    setStudyBlocks(newStudyBlocks);
    setTimeout(() => setIsGenerating(false), 500);
  };

  // Estimate study hours
  const estimateHours = (assignment) => {
    const type = assignment.type?.toLowerCase() || '';
    const text = assignment.text?.toLowerCase() || '';
    
    if (type === 'reading' || text.includes('chapter')) {
      const chapterCount = (text.match(/chapter/gi) || []).length;
      return Math.max(chapterCount * 1.5, 2);
    }
    
    if (type === 'video' || text.includes('video') || text.includes('watch')) {
      return 1;
    }
    
    if (type === 'paper' || type === 'project' || text.includes('paper') || text.includes('project')) {
      return 4;
    }
    
    if (type === 'discussion' || text.includes('discussion') || text.includes('post')) {
      return 1;
    }
    
    return 2;
  };

  // Get events for a specific date
  const getEventsForDate = (date) => {
    const dateStr = date.toDateString();
    return allEvents.filter(event => event.date.toDateString() === dateStr);
  };

  // Handle event click
  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
    setIsEditing(false);
  };

  // Handle event update
  const handleEventUpdate = (updatedEvent) => {
    if (updatedEvent.source === 'assignment' && onUpdateAssignment) {
      onUpdateAssignment(updatedEvent.assignmentId, {
        text: updatedEvent.title,
        date: updatedEvent.date,
        type: updatedEvent.type,
        hours: updatedEvent.hours,
        description: updatedEvent.description
      });
    } else if (updatedEvent.source === 'manual') {
      setManualEvents(prev => prev.map(e => 
        e.id === updatedEvent.id ? updatedEvent : e
      ));
    } else if (updatedEvent.source === 'generated') {
      setStudyBlocks(prev => prev.map(b => 
        b.id === updatedEvent.id ? updatedEvent : b
      ));
    }
    
    setShowEventModal(false);
    setIsEditing(false);
  };

  // Handle event delete
  const handleEventDelete = (event) => {
    if (event.source === 'manual') {
      setManualEvents(prev => prev.filter(e => e.id !== event.id));
    } else if (event.source === 'generated') {
      setStudyBlocks(prev => prev.filter(b => b.id !== event.id));
    }
    setShowEventModal(false);
  };

  // Handle add new event
  const handleAddEvent = (newEvent) => {
    const event = {
      ...newEvent,
      id: `manual_${Date.now()}`,
      date: new Date(newEvent.date),
      source: 'manual',
      courseCode: course.code
    };
    
    setManualEvents(prev => [...prev, event]);
    
    // If it needs study time, regenerate schedule
    if (event.needsStudyTime) {
      setTimeout(() => generateStudySchedule(), 100);
    }
    
    setShowAddModal(false);
  };

  // Check if date is today
  const isToday = (date) => {
    return date.toDateString() === today.toDateString();
  };

  // Month view component
  const MonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return (
      <div className="grid grid-cols-7 gap-1 bg-gray-200 p-1 rounded">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-gray-50 p-2 text-center text-sm font-semibold">
            {day}
          </div>
        ))}
        
        {days.map((date, index) => (
          <div
            key={index}
            className={`bg-white min-h-24 p-1 relative ${!date ? 'bg-gray-50' : ''} ${
              date && isToday(date) ? 'ring-2 ring-blue-500 ring-inset' : ''
            }`}
          >
            {date && (
              <>
                <div className={`font-semibold text-sm mb-1 ${isToday(date) ? 'text-blue-600' : ''}`}>
                  {date.getDate()}
                  {isToday(date) && <span className="text-xs ml-1 text-blue-600">Today</span>}
                </div>
                <div className="space-y-1">
                  {getEventsForDate(date).slice(0, 3).map((event, i) => (
                    <div
                      key={i}
                      onClick={() => handleEventClick(event)}
                      className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${
                        event.type === 'lecture' ? 'bg-blue-500 text-white' :
                        event.type === 'clinical' ? 'bg-green-500 text-white' :
                        event.type === 'exam' ? 'bg-red-500 text-white' :
                        event.type === 'study' ? 'bg-gray-800 text-white' :
                        'bg-gray-300'
                      }`}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {getEventsForDate(date).length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{getEventsForDate(date).length - 3} more
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Week view component
  const WeekView = () => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDays.push(day);
    }

    const hours = Array.from({ length: 17 }, (_, i) => i + 6);

    return (
      <div className="bg-gray-100 rounded overflow-hidden">
        <div className="grid grid-cols-8 gap-px bg-gray-300">
          <div className="bg-gray-50 p-2"></div>
          {weekDays.map((day, i) => (
            <div key={i} className={`bg-gray-50 p-2 text-center text-sm font-semibold ${
              isToday(day) ? 'bg-blue-100 text-blue-700' : ''
            }`}>
              <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className={isToday(day) ? 'font-bold' : ''}>{day.getDate()}</div>
              {isToday(day) && <div className="text-xs">Today</div>}
            </div>
          ))}
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          <div className="grid grid-cols-8 gap-px bg-gray-300">
            {hours.map(hour => (
              <React.Fragment key={hour}>
                <div className="bg-gray-50 p-2 text-right text-sm">
                  {hour % 12 || 12}:00 {hour < 12 ? 'AM' : 'PM'}
                </div>
                {weekDays.map((day, i) => {
                  const events = getEventsForDate(day).filter(e => {
                    if (!e.time) return hour === 9;
                    const eventHour = parseInt(e.time.split(':')[0]);
                    const isPM = e.time.includes('PM');
                    const hour24 = isPM && eventHour !== 12 ? eventHour + 12 : eventHour;
                    return hour24 === hour;
                  });

                  return (
                    <div key={i} className={`bg-white min-h-16 p-1 ${
                      isToday(day) ? 'bg-blue-50' : ''
                    }`}>
                      {events.map((event, j) => (
                        <div
                          key={j}
                          onClick={() => handleEventClick(event)}
                          className={`text-xs p-1 rounded mb-1 cursor-pointer hover:opacity-80 ${
                            event.type === 'lecture' ? 'bg-blue-500 text-white' :
                            event.type === 'clinical' ? 'bg-green-500 text-white' :
                            event.type === 'exam' ? 'bg-red-500 text-white' :
                            event.type === 'study' ? 'bg-gray-800 text-white' :
                            'bg-gray-300'
                          }`}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Event Modal Component
  const EventModal = () => {
    const [editData, setEditData] = useState({
      title: selectedEvent?.title || '',
      date: selectedEvent?.date ? selectedEvent.date.toISOString().split('T')[0] : '',
      time: selectedEvent?.time || '',
      type: selectedEvent?.type || 'event',
      hours: selectedEvent?.hours || '',
      description: selectedEvent?.description || '',
      needsStudyTime: selectedEvent?.needsStudyTime || false
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {isEditing ? 'Edit Event' : selectedEvent?.fullTitle || selectedEvent?.title}
            </h2>
            <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({...editData, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={editData.date}
                    onChange={(e) => setEditData({...editData, date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <input
                    type="text"
                    value={editData.time}
                    onChange={(e) => setEditData({...editData, time: e.target.value})}
                    placeholder="9:00 AM"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={editData.type}
                    onChange={(e) => setEditData({...editData, type: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="clinical">Clinical</option>
                    <option value="exam">Exam</option>
                    <option value="study">Study Block</option>
                    <option value="assignment">Assignment</option>
                    <option value="event">Other Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hours</label>
                  <input
                    type="number"
                    value={editData.hours}
                    onChange={(e) => setEditData({...editData, hours: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    step="0.5"
                    min="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows="3"
                />
              </div>
              
              {selectedEvent?.source === 'manual' && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editData.needsStudyTime}
                    onChange={(e) => setEditData({...editData, needsStudyTime: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm">Needs study time scheduled</span>
                </label>
              )}
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleEventUpdate({
                    ...selectedEvent,
                    ...editData,
                    date: new Date(editData.date)
                  })}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium">
                  {selectedEvent?.date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              
              {selectedEvent?.time && (
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-medium">{selectedEvent.time}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-medium capitalize">{selectedEvent?.type}</p>
              </div>
              
              {selectedEvent?.hours && (
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-medium">{selectedEvent.hours} hours</p>
                </div>
              )}
              
              {selectedEvent?.description && (
                <div>
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="font-medium">{selectedEvent.description}</p>
                </div>
              )}
              
              {selectedEvent?.source && (
                <div>
                  <p className="text-sm text-gray-600">Source</p>
                  <p className="font-medium capitalize">
                    {selectedEvent.source === 'generated' ? 'Auto-generated' : selectedEvent.source}
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                {(selectedEvent?.source === 'manual' || selectedEvent?.source === 'generated') && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
                    >
                      <Edit2 size={16} className="mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this event?')) {
                          handleEventDelete(selectedEvent);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Add Event Modal Component
  const AddEventModal = () => {
    const [newEvent, setNewEvent] = useState({
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '',
      type: 'event',
      hours: '',
      description: '',
      needsStudyTime: false
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Add New Event</h2>
            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Event title"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Time</label>
                <input
                  type="text"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                  placeholder="9:00 AM"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="event">Event</option>
                  <option value="lecture">Lecture</option>
                  <option value="clinical">Clinical</option>
                  <option value="exam">Exam</option>
                  <option value="assignment">Assignment</option>
                  <option value="reading">Reading</option>
                  <option value="project">Project</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hours</label>
                <input
                  type="number"
                  value={newEvent.hours}
                  onChange={(e) => setNewEvent({...newEvent, hours: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  step="0.5"
                  min="0"
                  placeholder="2"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                rows="3"
                placeholder="Additional details..."
              />
            </div>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newEvent.needsStudyTime}
                onChange={(e) => setNewEvent({...newEvent, needsStudyTime: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Needs study time scheduled</span>
            </label>
            
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newEvent.title.trim()) {
                    handleAddEvent(newEvent);
                  }
                }}
                disabled={!newEvent.title.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (7 * direction));
    setCurrentDate(newDate);
  };

  // Stats
  const stats = useMemo(() => {
    const studyableAssignments = assignments.filter(a => 
      !extractedEvents.some(e => e.assignmentId === a.id) && a.date
    );
    
    return {
      totalAssignments: studyableAssignments.length,
      totalStudyHours: studyableAssignments.reduce((sum, a) => sum + (a.hours || estimateHours(a)), 0),
      scheduledHours: studyBlocks.reduce((sum, b) => sum + b.hours, 0),
      upcomingEvents: extractedEvents.filter(e => e.date >= new Date()).length,
      manualEvents: manualEvents.length
    };
  }, [assignments, extractedEvents, studyBlocks, manualEvents]);

  return (
    <div className="space-y-6">
      {/* Dynamic Scheduler Controls */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            Dynamic Study Scheduler
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event</span>
            </button>
            <button
              onClick={generateStudySchedule}
              disabled={isGenerating || stats.totalAssignments === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  <span>Generate Schedule</span>
                </>
              )}
            </button>
            <button
              onClick={() => setStudyBlocks([])}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Clear
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-600">Daily Max (hrs)</label>
            <input
              type="number"
              value={preferences.dailyMax}
              onChange={(e) => setPreferences({...preferences, dailyMax: parseInt(e.target.value)})}
              className="w-full p-2 border rounded"
              min="1"
              max="12"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Weekend Max (hrs)</label>
            <input
              type="number"
              value={preferences.weekendMax}
              onChange={(e) => setPreferences({...preferences, weekendMax: parseInt(e.target.value)})}
              className="w-full p-2 border rounded"
              min="1"
              max="8"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Block Duration</label>
            <input
              type="number"
              value={preferences.blockDuration}
              onChange={(e) => setPreferences({...preferences, blockDuration: parseFloat(e.target.value)})}
              className="w-full p-2 border rounded"
              min="0.5"
              max="3"
              step="0.5"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Buffer Days</label>
            <input
              type="number"
              value={preferences.bufferDays}
              onChange={(e) => setPreferences({...preferences, bufferDays: parseInt(e.target.value)})}
              className="w-full p-2 border rounded"
              min="1"
              max="7"
            />
          </div>
        </div>
        
        {/* Schedule Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-sm text-blue-600 font-medium">{stats.totalAssignments}</div>
            <div className="text-xs text-blue-700">Study Tasks</div>
          </div>
          <div className="bg-purple-50 p-3 rounded">
            <div className="text-sm text-purple-600 font-medium">{stats.totalStudyHours.toFixed(1)}h</div>
            <div className="text-xs text-purple-700">Total Needed</div>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <div className="text-sm text-green-600 font-medium">{stats.scheduledHours.toFixed(1)}h</div>
            <div className="text-xs text-green-700">Scheduled</div>
          </div>
          <div className="bg-orange-50 p-3 rounded">
            <div className="text-sm text-orange-600 font-medium">{stats.upcomingEvents}</div>
            <div className="text-xs text-orange-700">Events</div>
          </div>
          <div className="bg-teal-50 p-3 rounded">
            <div className="text-sm text-teal-600 font-medium">{stats.manualEvents}</div>
            <div className="text-xs text-teal-700">Manual</div>
          </div>
        </div>
        
        {studyBlocks.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-800">
              Successfully scheduled {studyBlocks.length} study blocks
            </p>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => currentView === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => currentView === 'month' ? navigateMonth(1) : navigateWeek(1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Today
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentView('month')}
              className={`px-3 py-1 rounded ${currentView === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Month
            </button>
            <button
              onClick={() => setCurrentView('week')}
              className={`px-3 py-1 rounded ${currentView === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Week
            </button>
          </div>
        </div>
        
        {currentView === 'month' ? <MonthView /> : <WeekView />}
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Lecture/Class</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Clinical/Lab</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Exam/Quiz</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-800 rounded"></div>
            <span>Study Block</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEventModal && selectedEvent && <EventModal />}
      {showAddModal && <AddEventModal />}
    </div>
  );
}

export default CalendarView;