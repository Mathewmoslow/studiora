import React, { useState, useEffect } from 'react';
import {
  BookOpen, Calendar, Plus, Settings, Download, Upload,
  Users, Brain, X, Menu, Moon, Sun, FileText, ChevronRight,
  AlertCircle, AlertTriangle
} from 'lucide-react';
import CalendarView from './CalendarView';
//import ImportWizard from './components/ImportWizard'; // Keep for now but won't be used
//import { StudioraDualParser } from './services/StudioraDualParser'; // Keep for now but won't be used
import CourseExtractorModal, { StudiorExtractorCard } from './components/CourseExtractorModal';

// Data Manager Class
class DataManager {
  static STORAGE_KEY = 'studioraData';
  static THEME_KEY = 'studioraTheme';

  static loadData() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        return {
          courses: data.courses || [],
          assignments: data.assignments || [],
          studyBlocks: data.studyBlocks || [],
          calendarEvents: data.calendarEvents || [],
          userPreferences: data.userPreferences || {},
          parsingHistory: data.parsingHistory || []
        };
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }

    return {
      courses: [],
      assignments: [],
      studyBlocks: [],
      calendarEvents: [],
      userPreferences: {},
      parsingHistory: []
    };
  }

  static saveData(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  static exportData(data) {
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `studiora_backup_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  static importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);

          if (!data.courses || !Array.isArray(data.courses)) {
            throw new Error('Invalid data format: missing courses array');
          }

          resolve({
            courses: data.courses || [],
            assignments: data.assignments || [],
            studyBlocks: data.studyBlocks || [],
            calendarEvents: data.calendarEvents || [],
            userPreferences: data.userPreferences || {},
            parsingHistory: data.parsingHistory || []
          });
        } catch (error) {
          reject(new Error(`Failed to parse data file: ${error.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  static getTheme() {
    try {
      return localStorage.getItem(this.THEME_KEY) || 'light';
    } catch {
      return 'light';
    }
  }

  static setTheme(theme) {
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }
}

// Modal Components
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function AddCourseModal({ onClose, onAdd }) {
  const [courseData, setCourseData] = useState({
    code: '',
    name: '',
    credits: '',
    instructor: '',
    color: '#3B82F6'
  });

  const handleSubmit = () => {
    if (courseData.code && courseData.name) {
      onAdd(courseData);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Add New Course</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Course Code*
            </label>
            <input
              type="text"
              value={courseData.code}
              onChange={(e) => setCourseData({ ...courseData, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="NURS 101"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Course Name*
            </label>
            <input
              type="text"
              value={courseData.name}
              onChange={(e) => setCourseData({ ...courseData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Introduction to Nursing"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Credits
              </label>
              <input
                type="text"
                value={courseData.credits}
                onChange={(e) => setCourseData({ ...courseData, credits: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Color
              </label>
              <input
                type="color"
                value={courseData.color}
                onChange={(e) => setCourseData({ ...courseData, color: e.target.value })}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Instructor
            </label>
            <input
              type="text"
              value={courseData.instructor}
              onChange={(e) => setCourseData({ ...courseData, instructor: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Dr. Smith"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSubmit}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add Course
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DataManagerModal({ appData, onClose, onImport }) {
  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const data = await DataManager.importData(file);
        onImport(data);
        onClose();
      } catch (error) {
        alert(`Import failed: ${error.message}`);
      }
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Data Management</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2 dark:text-white">Export Data</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Download all your data as a backup file
            </p>
            <button
              onClick={() => DataManager.exportData(appData)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Export Data
            </button>
          </div>

          <div className="border-t dark:border-gray-700 pt-4">
            <h3 className="font-medium mb-2 dark:text-white">Import Data</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Upload a previously exported backup file
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
              <span className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 inline-block">
                <Upload className="h-4 w-4" />
                Import Data
              </span>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Workload Analysis Component
function WorkloadAnalysis({ assignments, courses }) {
  // Calculate daily workload
  const workloadByDate = {};
  assignments.forEach(assignment => {
    const date = new Date(assignment.date).toDateString();
    if (!workloadByDate[date]) {
      workloadByDate[date] = [];
    }
    workloadByDate[date].push(assignment);
  });

  // Find conflict dates (3+ assignments)
  const conflictDates = Object.entries(workloadByDate)
    .filter(([date, assignments]) => assignments.length >= 3)
    .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mt-4">
      <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Workload Alerts
      </h4>
      {conflictDates.length > 0 ? (
        <div className="space-y-2 text-sm">
          {conflictDates.slice(0, 3).map(([date, assignments]) => (
            <div key={date} className="text-yellow-700 dark:text-yellow-300">
              <span className="font-medium">{new Date(date).toLocaleDateString()}</span>:
              {assignments.length} assignments due
              <div className="text-xs opacity-75 ml-2">
                {assignments.map(a =>
                  `${courses.find(c => c.id === a.course)?.code}: ${a.text.substring(0, 20)}...`
                ).join(', ')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-yellow-700 dark:text-yellow-300">No scheduling conflicts detected</p>
      )}
    </div>
  );
}

// Component Views
function AllCoursesOverview({ courses, assignments, completedAssignments, onToggleAssignment, onOpenExtractor }) {
  const stats = {
    totalCourses: courses.length,
    totalAssignments: assignments.length,
    completedAssignments: completedAssignments.size,
    upcomingAssignments: assignments.filter(a =>
      new Date(a.date) > new Date() && !completedAssignments.has(a.id)
    ).length
  };

  const upcomingAssignments = assignments
    .filter(a => new Date(a.date) > new Date() && !completedAssignments.has(a.id))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.totalCourses}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Active Courses</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.totalAssignments}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Assignments</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">{stats.completedAssignments}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-orange-600">{stats.upcomingAssignments}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Upcoming</div>
        </div>
      </div>

      {/* Studiora Extractor Card */}
      <StudiorExtractorCard onOpen={onOpenExtractor} />

      {/* Workload Analysis */}
      <WorkloadAnalysis assignments={assignments} courses={courses} />

      {/* Upcoming Assignments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Upcoming Assignments</h3>
        {upcomingAssignments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No upcoming assignments</p>
        ) : (
          <div className="space-y-3">
            {upcomingAssignments.map(assignment => (
              <AssignmentItem
                key={assignment.id}
                assignment={assignment}
                isCompleted={completedAssignments.has(assignment.id)}
                onToggle={() => onToggleAssignment(assignment.id)}
                course={courses.find(c => c.id === assignment.course)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Course List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">All Courses</h3>
        <div className="grid gap-4">
          {courses.map(course => {
            const courseAssignments = assignments.filter(a => a.course === course.id);
            const courseCompleted = courseAssignments.filter(a => completedAssignments.has(a.id)).length;

            return (
              <div key={course.id} className="border dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium dark:text-white">{course.code} - {course.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {courseAssignments.length} assignments • {courseCompleted} completed
                    </p>
                  </div>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: course.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CourseDashboard({ course, courses, assignments, completedAssignments, onToggleAssignment, onOpenExtractor, viewMode }) {
  // Generate course colors for all courses view
  const courseColors = {};
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];

  courses?.forEach((course, index) => {
    courseColors[course.id] = course.color || colors[index % colors.length];
  });

  if (viewMode === 'all') {
    // Calculate aggregate statistics
    const totalAssignments = assignments.length;
    const completedCount = assignments.filter(a => completedAssignments.has(a.id)).length;
    const upcomingCount = assignments.filter(a =>
      new Date(a.date) > new Date() && !completedAssignments.has(a.id)
    ).length;
    const overdueCount = assignments.filter(a =>
      new Date(a.date) < new Date() && !completedAssignments.has(a.id)
    ).length;

    // Group assignments by course
    const assignmentsByCourse = {};
    courses.forEach(course => {
      assignmentsByCourse[course.id] = assignments.filter(a => a.course === course.id);
    });

    return (
      <div className="space-y-4">
        {/* Overall Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{totalAssignments}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">{upcomingCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Upcoming</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Overdue</div>
          </div>
        </div>

        {/* Workload Analysis */}
        <WorkloadAnalysis assignments={assignments} courses={courses} />

        {/* Assignments by Course */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">All Assignments by Course</h3>
          <div className="space-y-6">
            {courses.map(course => {
              const courseAssignments = assignmentsByCourse[course.id] || [];
              if (courseAssignments.length === 0) return null;

              return (
                <div key={course.id} className="border-l-4 pl-4" style={{ borderColor: courseColors[course.id] }}>
                  <h4 className="font-medium mb-2 dark:text-white">
                    {course.code} - {course.name}
                    <span className="text-sm text-gray-500 ml-2">
                      ({courseAssignments.filter(a => completedAssignments.has(a.id)).length}/{courseAssignments.length})
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {courseAssignments
                      .sort((a, b) => new Date(a.date) - new Date(b.date))
                      .map(assignment => (
                        <AssignmentItem
                          key={assignment.id}
                          assignment={assignment}
                          isCompleted={completedAssignments.has(assignment.id)}
                          onToggle={() => onToggleAssignment(assignment.id)}
                          showCourse={false}
                        />
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Original single course view
  const courseAssignments = assignments.filter(a => a.course === course.id);
  const upcomingAssignments = courseAssignments.filter(a =>
    new Date(a.date) > new Date() && !completedAssignments.has(a.id)
  );
  const completedCount = courseAssignments.filter(a => completedAssignments.has(a.id)).length;

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">{course.name}</h2>
            <p className="text-gray-600 dark:text-gray-400">{course.code}</p>
            {course.instructor && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Instructor: {course.instructor}
              </p>
            )}
          </div>
          <button
            onClick={onOpenExtractor}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Brain className="h-4 w-4" />
            Extract from Syllabus
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Progress</span>
            <span className="text-gray-600 dark:text-gray-400">
              {completedCount} of {courseAssignments.length} completed
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${courseAssignments.length > 0 ? (completedCount / courseAssignments.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Assignments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Assignments</h3>
        {courseAssignments.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">No assignments yet</p>
            <button
              onClick={onOpenExtractor}
              className="mt-4 text-purple-600 hover:text-purple-700"
            >
              Extract assignments from syllabus
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {courseAssignments
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map(assignment => (
                <AssignmentItem
                  key={assignment.id}
                  assignment={assignment}
                  isCompleted={completedAssignments.has(assignment.id)}
                  onToggle={() => onToggleAssignment(assignment.id)}
                  showCourse={false}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentItem({ assignment, isCompleted, onToggle, course, showCourse = true }) {
  const dueDate = new Date(assignment.date);
  const now = new Date();
  const isOverdue = dueDate < now && !isCompleted;

  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={onToggle}
        className="mt-1 rounded text-blue-600"
      />
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <h4 className={`font-medium ${isCompleted ? 'line-through text-gray-500' : 'dark:text-white'}`}>
              {assignment.text}
            </h4>
            {showCourse && course && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{course.code}</p>
            )}
            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                {isOverdue ? 'OVERDUE - ' : ''}
                Due: {dueDate.toLocaleDateString()}
              </span>
              <span>{assignment.hours}h</span>
              {assignment.confidence && (
                <span>{Math.round(assignment.confidence * 100)}% confidence</span>
              )}
            </div>
          </div>
        </div>

        {assignment.source && (
          <div className="mt-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${assignment.source.includes('studiora') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
              {assignment.source}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DataView({ appData }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Data Overview</h2>
      <div className="space-y-4">
        <div>
          <h3 className="font-medium dark:text-white">Courses ({appData.courses.length})</h3>
          <div className="mt-2 space-y-1">
            {appData.courses.map(course => (
              <div key={course.id} className="text-sm text-gray-600 dark:text-gray-400">
                {course.code} - {course.name}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-medium dark:text-white">Recent Parsing History</h3>
          <div className="mt-2 space-y-1">
            {appData.parsingHistory.slice(-5).map(history => (
              <div key={history.id} className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(history.timestamp).toLocaleDateString()} - {history.assignmentCount} assignments from {history.documentType}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Scheduler Update Notification Component
function SchedulerUpdateNotification({ onGoToScheduler, onDismiss }) {
  return (
    <div
      className="fixed bottom-4 right-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 shadow-lg max-w-sm animate-in slide-in-from-bottom"
      style={{
        animation: 'slide-in 0.3s ease-out'
      }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Study Schedule Update Available
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            You've completed assignments with study blocks. Want to optimize your study schedule?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onGoToScheduler}
              className="text-sm px-3 py-1.5 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              Review Study Plan
            </button>
            <button
              onClick={onDismiss}
              className="text-sm px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function StudioraNursingPlanner() {
  const [appData, setAppData] = useState(DataManager.loadData());
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showExtractor, setShowExtractor] = useState(false);
  const [showDataManager, setShowDataManager] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [completedAssignments, setCompletedAssignments] = useState(new Set());
  const [isDarkMode, setIsDarkMode] = useState(DataManager.getTheme() === 'dark');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showSchedulerNotification, setShowSchedulerNotification] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'single'

  // Apply dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    DataManager.setTheme(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Auto-save when data changes
  useEffect(() => {
    DataManager.saveData(appData);
  }, [appData]);

  // Select first course by default if in single mode
  useEffect(() => {
    if (viewMode === 'single' && !selectedCourse && appData.courses.length > 0) {
      setSelectedCourse(appData.courses[0]);
    }
  }, [appData.courses, selectedCourse, viewMode]);

  // Watch for completed assignments with study blocks
  useEffect(() => {
    const hasStudyBlocks = appData.studyBlocks.length > 0;
    if (hasStudyBlocks && completedAssignments.size > 0) {
      // Check if any completed assignment has study blocks
      const completedHasBlocks = [...completedAssignments].some(id =>
        appData.studyBlocks.some(block => block.assignmentId === id)
      );
      if (completedHasBlocks && currentView !== 'calendar') {
        setShowSchedulerNotification(true);
      }
    }
  }, [completedAssignments, appData.studyBlocks, currentView]);

  const addCourse = (courseData) => {
    const newCourse = {
      id: `course_${Date.now()}`,
      ...courseData,
      createdAt: new Date().toISOString()
    };

    setAppData(prev => ({
      ...prev,
      courses: [...prev.courses, newCourse]
    }));

    setSelectedCourse(newCourse);
    setShowAddCourse(false);
  };

  const updateCourse = (courseId, updates) => {
    setAppData(prev => ({
      ...prev,
      courses: prev.courses.map(c =>
        c.id === courseId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      )
    }));
  };

  const deleteCourse = (courseId) => {
    if (window.confirm('Are you sure you want to delete this course and all its assignments?')) {
      setAppData(prev => ({
        ...prev,
        courses: prev.courses.filter(c => c.id !== courseId),
        assignments: prev.assignments.filter(a => a.course !== courseId),
        studyBlocks: prev.studyBlocks.filter(s => s.courseId !== courseId),
        calendarEvents: prev.calendarEvents?.filter(e => e.courseId !== courseId) || []
      }));

      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
      }
    }
  };

  const toggleAssignment = (assignmentId) => {
    setCompletedAssignments(prev => {
      const newCompleted = new Set(prev);
      if (newCompleted.has(assignmentId)) {
        newCompleted.delete(assignmentId);
      } else {
        newCompleted.add(assignmentId);
      }
      return newCompleted;
    });

    // Save state after toggling
    DataManager.saveData(appData);
  };

  const updateAssignment = (assignmentId, updates) => {
    setAppData(prev => ({
      ...prev,
      assignments: prev.assignments.map(a =>
        a.id === assignmentId ? { ...a, ...updates } : a
      )
    }));
  };

  const addAssignment = (assignment) => {
    setAppData(prev => ({
      ...prev,
      assignments: [...prev.assignments, assignment]
    }));
  };

  const handleExtractComplete = (assignments) => {
    // Add extracted assignments to app data
    setAppData(prev => ({
      ...prev,
      assignments: [...prev.assignments, ...assignments]
    }));

    // Add to parsing history
    const history = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      documentType: 'studiora-extracted',
      assignmentCount: assignments.length,
      confidence: 0.95
    };

    setAppData(prev => ({
      ...prev,
      parsingHistory: [...prev.parsingHistory, history]
    }));

    console.log(`Added ${assignments.length} items from Studiora extraction`);
  };

  const handleDataImport = (importedData) => {
    setAppData(importedData);
  };

  // Filter assignments based on view mode
  const courseAssignments = viewMode === 'all'
    ? appData.assignments
    : appData.assignments.filter(a => a.course === selectedCourse?.id);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile Navigation Toggle */}
      <button
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg"
      >
        <Menu className="h-6 w-6 dark:text-white" />
      </button>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } z-40`}>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Studiora</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Nursing Course Manager</p>
        </div>

        <nav className="mt-6">
          <div className="px-6 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase">Courses</h2>
              <button
                onClick={() => setShowAddCourse(true)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Plus size={16} />
              </button>
            </div>

            {appData.courses.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No courses yet</p>
            ) : (
              <div className="space-y-1">
                {/* All Courses Option */}
                <button
                  onClick={() => {
                    setViewMode('all');
                    setSelectedCourse(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between group transition-colors ${viewMode === 'all'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">All Courses</span>
                  </div>
                  <span className="text-xs opacity-60">
                    {appData.assignments.length} total
                  </span>
                </button>

                <div className="border-t dark:border-gray-700 pt-2 mb-2"></div>

                {/* Individual Courses */}
                {appData.courses.map(course => (
                  <button
                    key={course.id}
                    onClick={() => {
                      setSelectedCourse(course);
                      setViewMode('single');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center ${viewMode === 'single' && selectedCourse?.id === course.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    <div
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: course.color }}
                    />
                    {course.code}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 mt-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase mb-2">Tools</h2>
            <button
              onClick={() => setShowExtractor(true)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
            >
              <Brain className="h-4 w-4 mr-2" />
              Course Extractor
            </button>
            <button
              onClick={() => setShowDataManager(true)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
            >
              <Settings className="h-4 w-4 mr-2" />
              Data Manager
            </button>
          </div>
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {viewMode === 'all' && appData.courses.length === 0 ? (
            <AllCoursesOverview
              courses={appData.courses}
              assignments={appData.assignments}
              completedAssignments={completedAssignments}
              onToggleAssignment={toggleAssignment}
              onOpenExtractor={() => setShowExtractor(true)}
            />
          ) : (
            <>
              {/* View Tabs */}
              <div className="flex gap-2 mb-6">
                {['dashboard', 'calendar', 'data'].map(view => (
                  <button
                    key={view}
                    onClick={() => setCurrentView(view)}
                    className={`px-4 py-2 rounded-lg capitalize ${currentView === view
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    {view}
                  </button>
                ))}
              </div>

              {/* Content based on view */}
              {currentView === 'dashboard' ? (
                <CourseDashboard
                  course={selectedCourse}
                  courses={appData.courses}
                  assignments={courseAssignments}
                  completedAssignments={completedAssignments}
                  onToggleAssignment={toggleAssignment}
                  onOpenExtractor={() => setShowExtractor(true)}
                  viewMode={viewMode}
                />
              ) : currentView === 'calendar' ? (
                <CalendarView
                  courses={appData.courses}
                  assignments={courseAssignments}
                  studyBlocks={viewMode === 'all'
                    ? appData.studyBlocks
                    : appData.studyBlocks.filter(s => s.courseId === selectedCourse?.id)
                  }
                  calendarEvents={viewMode === 'all'
                    ? appData.calendarEvents || []
                    : appData.calendarEvents?.filter(e => e.courseId === selectedCourse?.id) || []
                  }
                  onUpdateAssignment={updateAssignment}
                  onAddAssignment={addAssignment}
                  viewMode={viewMode}
                  completedAssignments={completedAssignments}
                />
              ) : (
                <DataView appData={appData} />
              )}
            </>
          )}
        </div>
      </main>

      {/* Scheduler Update Notification */}
      {showSchedulerNotification && currentView !== 'calendar' && (
        <SchedulerUpdateNotification
          onGoToScheduler={() => {
            setCurrentView('calendar');
            setShowSchedulerNotification(false);
          }}
          onDismiss={() => setShowSchedulerNotification(false)}
        />
      )}

      {/* Modals */}
      {showAddCourse && (
        <AddCourseModal onClose={() => setShowAddCourse(false)} onAdd={addCourse} />
      )}

      {showExtractor && (
        <CourseExtractorModal
          isOpen={showExtractor}
          onClose={() => setShowExtractor(false)}
          onExtractComplete={handleExtractComplete}
          courses={appData.courses}
        />
      )}

      {showDataManager && (
        <DataManagerModal
          appData={appData}
          onClose={() => setShowDataManager(false)}
          onImport={handleDataImport}
        />
      )}
    </div>
  );
}

// Add CSS for slide-in animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

export default StudioraNursingPlanner;