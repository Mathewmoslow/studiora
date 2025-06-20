// CalendarView.jsx - Using react-big-calendar for unified course view
import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BookOpen
} from 'lucide-react';

// Import react-big-calendar styles
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Setup date-fns localizer
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

// Course color palette
const COURSE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
];

function CalendarView({ 
  courses, 
  assignments, 
  studyBlocks, 
  calendarEvents, 
  onUpdateAssignment, 
  onAddAssignment, 
  viewMode = 'all',
  completedAssignments = new Set()
}) {
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Generate course colors mapping
  const courseColors = useMemo(() => {
    const colors = {};
    courses?.forEach((course, index) => {
      colors[course.id] = COURSE_COLORS[index % COURSE_COLORS.length];
    });
    return colors;
  }, [courses]);

  // Transform assignments to calendar events
  const events = useMemo(() => {
    const allEvents = [];

    // Add assignments
    assignments.forEach(assignment => {
      const course = courses.find(c => c.id === assignment.courseId);
      const isCompleted = completedAssignments.has(assignment.id);
      
      allEvents.push({
        id: assignment.id,
        title: viewMode === 'all' 
          ? `[${course?.code}] ${assignment.text}`
          : assignment.text,
        start: new Date(assignment.date),
        end: new Date(assignment.date),
        allDay: true,
        resource: {
          type: 'assignment',
          assignment,
          course,
          completed: isCompleted
        },
        color: courseColors[assignment.courseId] || '#6B7280'
      });
    });

    // Add study blocks
    studyBlocks?.forEach(block => {
      const course = courses.find(c => c.id === block.courseId);
      
      allEvents.push({
        id: block.id,
        title: viewMode === 'all'
          ? `Study: ${course?.code}`
          : 'Study Block',
        start: new Date(block.startTime),
        end: new Date(block.endTime),
        resource: {
          type: 'study',
          block,
          course
        },
        color: courseColors[block.courseId] || '#9CA3AF'
      });
    });

    // Add other calendar events
    calendarEvents?.forEach(event => {
      const course = courses.find(c => c.id === event.courseId);
      
      allEvents.push({
        id: event.id,
        title: viewMode === 'all' && course
          ? `[${course.code}] ${event.title}`
          : event.title,
        start: new Date(event.start),
        end: new Date(event.end),
        allDay: event.allDay,
        resource: {
          type: 'event',
          event,
          course
        },
        color: event.courseId ? courseColors[event.courseId] : '#6B7280'
      });
    });

    return allEvents;
  }, [assignments, studyBlocks, calendarEvents, courses, courseColors, viewMode, completedAssignments]);

  // Custom event style
  const eventStyleGetter = useCallback((event) => {
    const baseStyle = {
      backgroundColor: event.color,
      borderRadius: '6px',
      border: 'none',
      fontSize: '0.875rem',
      padding: '2px 8px',
      cursor: 'pointer'
    };

    // Apply completed styling
    if (event.resource?.completed) {
      return {
        style: {
          ...baseStyle,
          opacity: 0.6,
          textDecoration: 'line-through',
          backgroundColor: '#9CA3AF'
        }
      };
    }

    // Apply overdue styling
    if (event.resource?.type === 'assignment' && 
        new Date(event.start) < new Date() && 
        !event.resource.completed) {
      return {
        style: {
          ...baseStyle,
          backgroundColor: '#DC2626',
          fontWeight: 'bold'
        }
      };
    }

    return { style: baseStyle };
  }, []);

  // Handle event selection
  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  }, []);

  // Handle slot selection (for adding new events)
  const handleSelectSlot = useCallback((slotInfo) => {
    setSelectedSlot(slotInfo);
    setShowAddModal(true);
  }, []);

  // Custom toolbar component
  const CustomToolbar = ({ date, view, onNavigate, onView }) => {
    const goToToday = () => onNavigate('TODAY');
    const goToNext = () => onNavigate('NEXT');
    const goToPrev = () => onNavigate('PREV');

    return (
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Today
          </button>
          <button
            onClick={goToNext}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <h2 className="text-xl font-semibold dark:text-white">
          {format(date, view === Views.DAY ? 'EEEE, MMMM d, yyyy' : 'MMMM yyyy')}
        </h2>

        <div className="flex gap-1">
          {[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA].map((viewName) => (
            <button
              key={viewName}
              onClick={() => onView(viewName)}
              className={`px-3 py-1 text-sm rounded-lg ${
                view === viewName
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {viewName.charAt(0) + viewName.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Workload indicator component
  const WorkloadIndicator = () => {
    const workloadByDate = useMemo(() => {
      const workload = {};
      assignments.forEach(assignment => {
        const dateKey = format(new Date(assignment.date), 'yyyy-MM-dd');
        if (!workload[dateKey]) {
          workload[dateKey] = [];
        }
        workload[dateKey].push(assignment);
      });
      return workload;
    }, [assignments]);

    const conflictDates = Object.entries(workloadByDate)
      .filter(([_, assignments]) => assignments.length >= 3)
      .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
      .slice(0, 5);

    if (conflictDates.length === 0) return null;

    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Workload Alerts
        </h4>
        <div className="space-y-1 text-sm">
          {conflictDates.map(([date, assignments]) => (
            <div key={date} className="text-yellow-700 dark:text-yellow-300">
              <span className="font-medium">{format(new Date(date), 'MMM d')}:</span>{' '}
              {assignments.length} assignments due
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Course legend for unified view
  const CourseLegend = () => {
    if (viewMode !== 'all') return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
        <h4 className="font-medium mb-2 dark:text-white">Course Legend</h4>
        <div className="flex flex-wrap gap-2">
          {courses.map((course, index) => (
            <div key={course.id} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: COURSE_COLORS[index % COURSE_COLORS.length] }}
              />
              <span className="text-sm dark:text-gray-300">{course.code}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {viewMode === 'all' && <WorkloadIndicator />}
      {viewMode === 'all' && <CourseLegend />}
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
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
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          popup
          components={{
            toolbar: CustomToolbar
          }}
          style={{ 
            height: 'calc(100vh - 300px)',
            minHeight: '500px'
          }}
          className="studiora-calendar"
        />
      </div>

      {/* Event Detail Modal */}
      {showEventModal && selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          courses={courses}
          onClose={() => {
            setShowEventModal(false);
            setSelectedEvent(null);
          }}
          onUpdate={(updates) => {
            if (selectedEvent.resource?.type === 'assignment') {
              onUpdateAssignment(selectedEvent.id, updates);
            }
            setShowEventModal(false);
          }}
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
            onAddAssignment(eventData);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

// Event Detail Modal Component
function EventDetailModal({ event, courses, onClose, onUpdate }) {
  const { resource } = event;
  const isAssignment = resource?.type === 'assignment';
  const assignment = resource?.assignment;
  const course = resource?.course;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold dark:text-white">{event.title}</h3>
            {course && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {course.code} - {course.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            <span className="dark:text-gray-300">
              {format(event.start, 'EEEE, MMMM d, yyyy')}
            </span>
          </div>

          {isAssignment && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span className="dark:text-gray-300">Type: {assignment.type}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="dark:text-gray-300">
                  Estimated time: {assignment.hours || 2} hours
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                {assignment.completed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">Completed</span>
                  </>
                ) : new Date(event.start) < new Date() ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">Overdue</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-yellow-600 dark:text-yellow-400">Pending</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          {isAssignment && !assignment.completed && (
            <button
              onClick={() => onUpdate({ completed: true })}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Mark Complete
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Event Modal Component
function AddEventModal({ slot, courses, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    title: '',
    courseId: courses[0]?.id || '',
    type: 'assignment',
    hours: 2,
    date: format(slot.start, 'yyyy-MM-dd')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      ...formData,
      date: new Date(formData.date),
      id: `event_${Date.now()}`
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-semibold mb-4 dark:text-white">Add New Event</h3>
        
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">
              Course
            </label>
            <select
              value={formData.courseId}
              onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
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
              <option value="clinical">Clinical</option>
              <option value="lab">Lab</option>
              <option value="study">Study Session</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
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

// Custom styles for react-big-calendar (add to your global CSS)
const calendarStyles = `
.studiora-calendar .rbc-month-view,
.studiora-calendar .rbc-time-view,
.studiora-calendar .rbc-agenda-view {
  border: none;
  background: transparent;
}

.studiora-calendar .rbc-header {
  padding: 8px;
  font-weight: 600;
  border-bottom: 2px solid #e5e7eb;
}

.dark .studiora-calendar .rbc-header {
  border-bottom-color: #374151;
  color: #d1d5db;
}

.studiora-calendar .rbc-today {
  background-color: #eff6ff;
}

.dark .studiora-calendar .rbc-today {
  background-color: #1e3a8a20;
}

.studiora-calendar .rbc-event {
  padding: 2px 8px;
  font-size: 0.875rem;
}

.studiora-calendar .rbc-event:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}
`;

export default CalendarView;