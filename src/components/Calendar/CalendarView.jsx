// src/components/CalendarView.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import addDays from 'date-fns/addDays';
import isToday from 'date-fns/isToday';
import isSameDay from 'date-fns/isSameDay';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  BookOpen,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';

// Import react-big-calendar styles
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Setup the localizer for react-big-calendar
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Course colors matching the original design
const getCourseColor = (courseCode) => {
  const colors = {
    'obgyn': '#2196F3',
    'adulthealth': '#4CAF50',
    'nclex': '#9C27B0',
    'geronto': '#FF9800',
    'default': '#6B7280'
  };

  const key = courseCode?.toLowerCase().replace(/[0-9]/g, '');
  return colors[key] || colors.default;
};

// Event type styling
const getEventTypeStyle = (type) => {
  const styles = {
    'lecture': { backgroundColor: '#2196F3', icon: '🏫' },
    'clinical': { backgroundColor: '#4CAF50', icon: '🏥' },
    'exam': { backgroundColor: '#f44336', icon: '📝' },
    'study': { backgroundColor: '#9333EA', icon: '📚' },
    'assignment': { backgroundColor: '#FF9800', icon: '📋' },
    'quiz': { backgroundColor: '#E91E63', icon: '✏️' },
    'lab': { backgroundColor: '#00BCD4', icon: '🔬' },
    'simulation': { backgroundColor: '#795548', icon: '🎮' }
  };

  return styles[type] || { backgroundColor: '#6B7280', icon: '📌' };
};

export default function CalendarView({
  courses = [],
  assignments = [],
  studyBlocks = [],
  calendarEvents = [],
  essentialEvents = [], // For lectures, clinicals, etc.
  onUpdateAssignment,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onDeleteStudyBlock,
  onToggleComplete,
  viewMode = 'all',
  completedAssignments = new Set(),
  currentWeek = 1
}) {
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Transform all events for the calendar
  const events = useMemo(() => {
    const allEvents = [];

    // Add assignments
    assignments.forEach(assignment => {
      const course = courses.find(c => c.id === assignment.courseId);
      const isCompleted = completedAssignments.has(assignment.id);
      const courseColor = course ? getCourseColor(course.code) : '#6B7280';

      allEvents.push({
        id: assignment.id,
        title: viewMode === 'all' && course
          ? `[${course.code}] ${assignment.text}`
          : assignment.text,
        start: new Date(assignment.date),
        end: new Date(assignment.date),
        allDay: true,
        resource: {
          type: 'assignment',
          data: assignment,
          course,
          completed: isCompleted
        },
        className: isCompleted ? 'completed' : '',
        style: {
          backgroundColor: isCompleted ? '#9CA3AF' : courseColor
        }
      });
    });

    // Add study blocks
    studyBlocks?.forEach(block => {
      const course = courses.find(c => c.id === block.courseId);

      allEvents.push({
        id: block.id,
        title: block.title || `Study: ${course?.code || 'General'}`,
        start: new Date(block.start || block.startTime),
        end: new Date(block.end || block.endTime),
        allDay: false,
        resource: {
          type: 'study',
          data: block,
          course
        },
        className: 'study-block',
        style: getEventTypeStyle('study')
      });
    });

    // Add calendar events
    calendarEvents?.forEach(event => {
      const course = courses.find(c => c.id === event.courseId);
      const styleInfo = getEventTypeStyle(event.type);

      allEvents.push({
        id: event.id,
        title: `${styleInfo.icon} ${event.title}`,
        start: new Date(event.start || event.date),
        end: new Date(event.end || event.date),
        allDay: event.allDay !== false,
        resource: {
          type: event.type || 'event',
          data: event,
          course
        },
        style: styleInfo
      });
    });

    // Add essential events (lectures, clinicals, etc.)
    essentialEvents?.forEach(event => {
      const styleInfo = getEventTypeStyle(event.type);

      allEvents.push({
        id: `essential_${event.date}_${event.title}`,
        title: `${styleInfo.icon} ${event.title}`,
        start: new Date(event.date),
        end: event.endTime ? new Date(event.endTime) : new Date(event.date),
        allDay: !event.time,
        resource: {
          type: event.type,
          data: event
        },
        style: styleInfo
      });
    });

    return allEvents;
  }, [assignments, studyBlocks, calendarEvents, essentialEvents, courses, viewMode, completedAssignments]);

  // Custom event style getter
  const eventStyleGetter = useCallback((event) => {
    let style = {
      ...event.style,
      borderRadius: '4px',
      border: 'none',
      fontSize: '0.75rem',
      padding: '2px 4px',
      cursor: 'pointer',
      color: 'white'
    };

    // Add specific styles based on type
    if (event.resource?.type === 'study') {
      style.borderLeft = '3px solid #7C3AED';
      style.backgroundColor = '#9333EA';
    }

    if (event.resource?.completed) {
      style.opacity = 0.6;
      style.textDecoration = 'line-through';
      style.backgroundColor = '#9CA3AF';
    }

    // Highlight overdue assignments
    const isOverdue = event.resource?.type === 'assignment' &&
      new Date(event.start) < new Date() &&
      !event.resource?.completed;

    if (isOverdue) {
      style.backgroundColor = '#DC2626';
      style.fontWeight = 'bold';
      style.animation = 'pulse 2s infinite';
    }

    return { style };
  }, []);

  // Custom day prop getter to highlight today
  const dayPropGetter = useCallback((date) => {
    if (isToday(date)) {
      return {
        className: 'rbc-today-highlight',
        style: {
          backgroundColor: '#EFF6FF'
        }
      };
    }
    return {};
  }, []);

  // Handle event selection
  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  }, []);

  // Handle slot selection
  const handleSelectSlot = useCallback((slotInfo) => {
    setSelectedSlot(slotInfo);
    setShowAddModal(true);
  }, []);

  // Custom Toolbar Component
  const CustomToolbar = ({ label, onNavigate, onView, view }) => {
    return (
      <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('PREV')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => onNavigate('TODAY')}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => onNavigate('NEXT')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <h2 className="text-lg font-semibold dark:text-white">
          {label}
        </h2>

        <div className="flex gap-1">
          <button
            onClick={() => onView(Views.MONTH)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${view === Views.MONTH
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            Month
          </button>
          <button
            onClick={() => onView(Views.WEEK)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${view === Views.WEEK
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            Week
          </button>
          <button
            onClick={() => onView(Views.DAY)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${view === Views.DAY
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            Day
          </button>
          <button
            onClick={() => onView(Views.AGENDA)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${view === Views.AGENDA
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            Agenda
          </button>
        </div>
      </div>
    );
  };

  // Custom event component for better display
  const CustomEvent = ({ event }) => {
    return (
      <div className="px-1 text-xs">
        {event.title}
      </div>
    );
  };

  return (
    <div className="calendar-container">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="mb-4">
          {viewMode !== 'all' && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Week {currentWeek} Schedule
            </div>
          )}
        </div>

        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter}
          dayPropGetter={dayPropGetter}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          popup
          components={{
            toolbar: CustomToolbar,
            event: CustomEvent
          }}
          style={{
            height: 'calc(100vh - 280px)',
            minHeight: '500px'
          }}
          formats={{
            dayFormat: 'EEE d',
            dayHeaderFormat: 'EEEE MMM d',
            monthHeaderFormat: 'MMMM yyyy'
          }}
          messages={{
            next: "Next",
            previous: "Previous",
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
            agenda: "Agenda"
          }}
        />
      </div>

      {/* Event Detail Modal */}
      {showEventModal && selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => {
            setShowEventModal(false);
            setSelectedEvent(null);
          }}
          onUpdate={onUpdateEvent}
          onDelete={(id) => {
            if (selectedEvent.resource?.type === 'study') {
              onDeleteStudyBlock(id);
            } else {
              onDeleteEvent(id);
            }
            setShowEventModal(false);
          }}
          onToggleComplete={onToggleComplete}
        />
      )}

      {/* Add Event Modal */}
      {showAddModal && selectedSlot && (
        <AddEventModal
          slot={selectedSlot}
          courses={courses}
          onClose={() => {
            setShowAddModal(false);
            setSelectedSlot(null);
          }}
          onAdd={(eventData) => {
            onAddEvent(eventData);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

// Event Detail Modal
function EventDetailModal({ event, onClose, onUpdate, onDelete, onToggleComplete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: event.title.replace(/^[^\s]+ /, ''), // Remove emoji prefix
    date: format(event.start, 'yyyy-MM-dd'),
    time: event.allDay ? '' : format(event.start, 'HH:mm'),
    type: event.resource?.type || 'event'
  });

  const resource = event.resource;
  const isAssignment = resource?.type === 'assignment';
  const isStudyBlock = resource?.type === 'study';
  const isCompleted = resource?.completed;

  const handleSave = () => {
    onUpdate(event.id, {
      ...editData,
      start: new Date(`${editData.date}T${editData.time || '00:00'}`),
      end: new Date(`${editData.date}T${editData.time || '23:59'}`)
    });
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold dark:text-white">
            {event.title}
          </h3>
          <div className="flex gap-2">
            {!isEditing && onUpdate && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Title
              </label>
              <input
                type="text"
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Date
                </label>
                <input
                  type="date"
                  value={editData.date}
                  onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Time
                </label>
                <input
                  type="time"
                  value={editData.time}
                  onChange={(e) => setEditData({ ...editData, time: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <span className="dark:text-gray-300">
                  {format(event.start, 'EEEE, MMMM d, yyyy')}
                </span>
              </div>

              {!event.allDay && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="dark:text-gray-300">
                    {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                  </span>
                </div>
              )}

              {resource?.course && (
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <span className="dark:text-gray-300">
                    {resource.course.code} - {resource.course.name}
                  </span>
                </div>
              )}

              {resource?.data?.type && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                    {resource.data.type}
                  </span>
                  {resource.data.hours && (
                    <span className="text-gray-500 dark:text-gray-400">
                      {resource.data.hours} hours
                    </span>
                  )}
                </div>
              )}

              {isAssignment && (
                <div className="flex items-center gap-2 text-sm">
                  {isCompleted ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">Completed</span>
                    </>
                  ) : new Date(event.start) < new Date() ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">Overdue</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="text-yellow-600 dark:text-yellow-400">Pending</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {isAssignment && onToggleComplete && (
                <button
                  onClick={() => onToggleComplete(event.id)}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${isCompleted
                      ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                      : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                >
                  {isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
              )}

              {(isStudyBlock || resource?.type === 'event') && onDelete && (
                <button
                  onClick={() => onDelete(event.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}

              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Add Event Modal
function AddEventModal({ slot, courses, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    title: '',
    courseId: courses[0]?.id || '',
    type: 'assignment',
    date: format(slot.start, 'yyyy-MM-dd'),
    time: slot.allDay ? '' : format(slot.start, 'HH:mm'),
    hours: 2,
    allDay: slot.allDay || true
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    const startDate = new Date(`${formData.date}T${formData.time || '00:00'}`);
    const endDate = new Date(startDate);

    if (formData.allDay) {
      endDate.setHours(23, 59, 59);
    } else {
      endDate.setHours(endDate.getHours() + formData.hours);
    }

    onAdd({
      id: `event_${Date.now()}`,
      title: formData.title,
      text: formData.title,
      courseId: formData.courseId,
      type: formData.type,
      date: startDate,
      start: startDate,
      end: endDate,
      hours: formData.hours,
      allDay: formData.allDay
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold dark:text-white">Add New Event</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Course
              </label>
              <select
                value={formData.courseId}
                onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">No Course</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="assignment">Assignment</option>
                <option value="exam">Exam</option>
                <option value="quiz">Quiz</option>
                <option value="reading">Reading</option>
                <option value="lecture">Lecture</option>
                <option value="clinical">Clinical</option>
                <option value="lab">Lab</option>
                <option value="study">Study Session</option>
                <option value="simulation">Simulation</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Time
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                disabled={formData.allDay}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.allDay}
                onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm dark:text-gray-300">All day event</span>
            </label>

            {!formData.allDay && (
              <div className="flex items-center gap-2">
                <label className="text-sm dark:text-gray-300">Duration:</label>
                <input
                  type="number"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })}
                  min="0.5"
                  max="8"
                  step="0.5"
                  className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <span className="text-sm dark:text-gray-300">hrs</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}