import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Calendar, Settings, Upload, Download, Plus, Edit2, Trash2, Save, X, Brain, FileText, Grid, List, Clock, Users, Sparkles, Zap, AlertCircle } from 'lucide-react';
import CalendarView from './components/Calendar/CalendarView';

// Import actual parsers
import { StudioraDualParser } from './services/StudioraDualParser.js';

// Data Management System
class DataManager {
  static STORAGE_KEY = 'studiora_complete_data';
  static VERSION = '1.0.0';

  static saveData(data) {
    const saveData = {
      version: this.VERSION,
      timestamp: new Date().toISOString(),
      courses: data.courses || [],
      assignments: data.assignments || [],
      studyBlocks: data.studyBlocks || [],
      calendarEvents: data.calendarEvents || [],
      userPreferences: data.userPreferences || {},
      parsingHistory: data.parsingHistory || []
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saveData));
    return saveData;
  }

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
    } catch (e) {
      console.warn('Failed to load data:', e);
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

  static exportData(data) {
    const exportData = {
      ...this.saveData(data),
      exportedAt: new Date().toISOString(),
      appName: 'Studiora',
      appVersion: this.VERSION
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studiora-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async importData(file) {
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
}

// Date formatting helper
const formatDate = (date, formatStr) => {
  const d = new Date(date);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (formatStr === 'EEEE') {
    return days[d.getDay()];
  } else if (formatStr === 'MMM d') {
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }
  return d.toLocaleDateString();
};

// Main App Component
function StudioraNursingPlanner() {
  const [appData, setAppData] = useState(DataManager.loadData());
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showDataManager, setShowDataManager] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [completedAssignments, setCompletedAssignments] = useState(new Set());
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'single'

  // Auto-save when data changes
  useEffect(() => {
    DataManager.saveData(appData);
  }, [appData]);

  // Select first course by default if in single mode
  useEffect(() => {
    if (!selectedCourse && appData.courses.length > 0 && viewMode === 'single') {
      setSelectedCourse(appData.courses[0]);
    }
  }, [appData.courses, selectedCourse, viewMode]);

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
    setViewMode('single');
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
        assignments: prev.assignments.filter(a => a.courseId !== courseId),
        studyBlocks: prev.studyBlocks.filter(s => s.courseId !== courseId)
      }));
      
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(appData.courses.find(c => c.id !== courseId) || null);
      }
    }
  };

  const handleImportComplete = (parseResults, importOptions) => {
    const newAssignments = parseResults.assignments.map(assignment => ({
      ...assignment,
      courseId: importOptions.courseId,
      importedAt: new Date().toISOString()
    }));
    
    setAppData(prev => ({
      ...prev,
      assignments: [...prev.assignments, ...newAssignments],
      parsingHistory: [...prev.parsingHistory, {
        id: `parse_${Date.now()}`,
        courseId: importOptions.courseId,
        documentType: importOptions.documentType,
        assignmentCount: newAssignments.length,
        confidence: parseResults.metadata?.confidence || parseResults.confidence || 0,
        timestamp: new Date().toISOString()
      }]
    }));
    
    setShowImportWizard(false);
  };

  const handleDataImport = async (importedData) => {
    setAppData(importedData);
    setShowDataManager(false);
    
    if (importedData.courses.length > 0) {
      setSelectedCourse(importedData.courses[0]);
    }
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

  const updateAssignment = (assignmentId, updates) => {
    setAppData(prev => ({
      ...prev,
      assignments: prev.assignments.map(a => 
        a.id === assignmentId 
          ? { ...a, ...updates, updatedAt: new Date().toISOString() } 
          : a
      )
    }));
  };

  const addAssignment = (assignmentData) => {
    const newAssignment = {
      id: `assignment_${Date.now()}`,
      ...assignmentData,
      courseId: selectedCourse.id,
      createdAt: new Date().toISOString(),
      source: 'manual'
    };
    
    setAppData(prev => ({
      ...prev,
      assignments: [...prev.assignments, newAssignment]
    }));
  };

  // Filtering logic
  const filteredAssignments = viewMode === 'all' 
    ? appData.assignments 
    : appData.assignments.filter(a => a.courseId === selectedCourse?.id);
  
  const filteredStudyBlocks = viewMode === 'all'
    ? appData.studyBlocks
    : appData.studyBlocks.filter(s => s.courseId === selectedCourse?.id);
  
  const filteredCalendarEvents = viewMode === 'all'
    ? appData.calendarEvents || []
    : (appData.calendarEvents || []).filter(e => e.courseId === selectedCourse?.id);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold dark:text-white">Studiora</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Intelligent Course Management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <nav className="hidden md:flex space-x-2">
                {['dashboard', 'calendar', 'data'].map(view => (
                  <button
                    key={view}
                    onClick={() => setCurrentView(view)}
                    className={`px-3 py-1 rounded text-sm capitalize ${
                      currentView === view 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </nav>
              
              <button
                onClick={() => setShowDataManager(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Data Management"
              >
                <Settings size={18} />
              </button>
              
              <button
                onClick={() => setShowImportWizard(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2 hover:bg-blue-700"
                disabled={appData.courses.length === 0}
              >
                <Upload size={16} />
                <span className="hidden sm:inline">Import</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {appData.courses.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <BookOpen className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Welcome to Studiora!</h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Start by adding your first course to begin organizing your assignments and schedule.
              </p>
              <button
                onClick={() => setShowAddCourse(true)}
                className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto hover:bg-blue-700"
              >
                <Plus size={20} />
                <span>Add Your First Course</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold dark:text-white">My Courses</h2>
                  <button
                    onClick={() => setShowAddCourse(true)}
                    className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    title="Add Course"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  {/* All Courses Button - Primary and prominent */}
                  <button
                    onClick={() => {
                      setViewMode('all');
                      setSelectedCourse(null);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between group transition-all mb-3 ${
                      viewMode === 'all' 
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg transform scale-105' 
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5" />
                      <div>
                        <div className="font-semibold">All Courses</div>
                        <div className="text-xs opacity-80">Complete Schedule View</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{appData.assignments.length}</div>
                      <div className="text-xs opacity-80">Total Tasks</div>
                    </div>
                  </button>
                  
                  {/* Separator */}
                  <div className="border-t dark:border-gray-700 my-3"></div>
                  
                  {/* Individual Courses */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
                      Individual Courses
                    </h3>
                    {appData.courses.map(course => {
                      const courseAssignmentCount = appData.assignments.filter(a => a.courseId === course.id).length;
                      const completedCount = appData.assignments.filter(
                        a => a.courseId === course.id && completedAssignments.has(a.id)
                      ).length;
                      
                      return (
                        <button
                          key={course.id}
                          onClick={() => {
                            setSelectedCourse(course);
                            setViewMode('single');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between group transition-colors ${
                            viewMode === 'single' && selectedCourse?.id === course.id 
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="font-medium dark:text-white">{course.code}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{course.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium dark:text-gray-300">{completedCount}/{courseAssignmentCount}</div>
                            <div className="text-xs text-gray-400">tasks</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold dark:text-white">
                  {viewMode === 'all' 
                    ? '📚 All Courses Schedule' 
                    : `📘 ${selectedCourse?.code} - ${selectedCourse?.name}`
                  }
                </h1>
                {viewMode === 'all' && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>{appData.courses.length} courses</span>
                    <span>•</span>
                    <span>{filteredAssignments.filter(a => !completedAssignments.has(a.id)).length} pending tasks</span>
                  </div>
                )}
              </div>

              {currentView === 'dashboard' ? (
                viewMode === 'all' ? (
                  <AllCoursesOverview
                    courses={appData.courses}
                    assignments={filteredAssignments}
                    completedAssignments={completedAssignments}
                    onToggleAssignment={toggleAssignment}
                    onImport={() => setShowImportWizard(true)}
                  />
                ) : (
                  <CourseDashboard
                    course={selectedCourse}
                    assignments={filteredAssignments}
                    completedAssignments={completedAssignments}
                    onToggleAssignment={toggleAssignment}
                    onImport={() => setShowImportWizard(true)}
                  />
                )
              ) : currentView === 'calendar' ? (
                <CalendarView
                  courses={appData.courses}
                  assignments={filteredAssignments}
                  studyBlocks={filteredStudyBlocks}
                  calendarEvents={filteredCalendarEvents}
                  onUpdateAssignment={updateAssignment}
                  onAddAssignment={addAssignment}
                  viewMode={viewMode}
                  completedAssignments={completedAssignments}
                />
              ) : (
                <DataView appData={appData} />
              )}
            </div>
          </div>
        )}
      </div>

      {showAddCourse && (
        <AddCourseModal onClose={() => setShowAddCourse(false)} onAdd={addCourse} />
      )}
      
      {showImportWizard && (
        <ImportWizard
          courses={appData.courses}
          onClose={() => setShowImportWizard(false)}
          onComplete={handleImportComplete}
        />
      )}
      
      {showDataManager && (
        <DataManagerModal
          appData={appData}
          onClose={() => setShowDataManager(false)}
          onImport={handleDataImport}
          onExport={() => DataManager.exportData(appData)}
        />
      )}
    </div>
  );
}

// All Courses Overview Component
function AllCoursesOverview({ courses, assignments, completedAssignments, onToggleAssignment, onImport }) {
  // Calculate statistics
  const stats = {
    total: assignments.length,
    completed: assignments.filter(a => completedAssignments.has(a.id)).length,
    upcoming: assignments.filter(a => 
      new Date(a.date) > new Date() && !completedAssignments.has(a.id)
    ).length,
    overdue: assignments.filter(a => 
      new Date(a.date) < new Date() && !completedAssignments.has(a.id)
    ).length,
    todayCount: assignments.filter(a => {
      const today = new Date();
      const assignmentDate = new Date(a.date);
      return assignmentDate.toDateString() === today.toDateString();
    }).length
  };

  // Group assignments by date for timeline view
  const upcomingByDate = {};
  assignments
    .filter(a => !completedAssignments.has(a.id))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(assignment => {
      const dateKey = new Date(assignment.date).toDateString();
      if (!upcomingByDate[dateKey]) {
        upcomingByDate[dateKey] = [];
      }
      upcomingByDate[dateKey].push(assignment);
    });

  // Get next 7 days of assignments
  const next7Days = Object.entries(upcomingByDate)
    .filter(([dateStr]) => {
      const date = new Date(dateStr);
      const daysDiff = Math.floor((date - new Date()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= 7;
    })
    .slice(0, 7);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          <div className="text-xs text-green-600 mt-1">
            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% done
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-yellow-600">{stats.upcoming}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Upcoming</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Overdue</div>
          {stats.overdue > 0 && (
            <div className="text-xs text-red-600 mt-1 animate-pulse">
              Action needed!
            </div>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-3xl font-bold text-purple-600">{stats.todayCount}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Due Today</div>
        </div>
      </div>

      {/* Next 7 Days Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Next 7 Days</h3>
        <div className="space-y-4">
          {next7Days.length > 0 ? (
            next7Days.map(([dateStr, dayAssignments]) => {
              const date = new Date(dateStr);
              const isToday = date.toDateString() === new Date().toDateString();
              const dayName = formatDate(date, 'EEEE');
              const dateFormatted = formatDate(date, 'MMM d');
              
              return (
                <div 
                  key={dateStr} 
                  className={`border-l-4 pl-4 ${
                    isToday ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 -ml-6 pl-10' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="font-medium dark:text-white">{dayName}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{dateFormatted}</span>
                      {isToday && (
                        <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded">Today</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {dayAssignments.length} task{dayAssignments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {dayAssignments.map(assignment => {
                      const course = courses.find(c => c.id === assignment.courseId);
                      return (
                        <div 
                          key={assignment.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={completedAssignments.has(assignment.id)}
                            onChange={() => onToggleAssignment(assignment.id)}
                            className="rounded"
                          />
                          <span className="font-medium text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {course?.code}
                          </span>
                          <span className={`dark:text-gray-300 ${completedAssignments.has(assignment.id) ? 'line-through opacity-60' : ''}`}>
                            {assignment.text}
                          </span>
                          {assignment.type && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">({assignment.type})</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No assignments due in the next 7 days! 🎉
            </p>
          )}
        </div>
      </div>

      {/* Course Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Course Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course, index) => {
            const courseAssignments = assignments.filter(a => a.courseId === course.id);
            const courseCompleted = courseAssignments.filter(a => completedAssignments.has(a.id)).length;
            const percentage = courseAssignments.length > 0 
              ? Math.round((courseCompleted / courseAssignments.length) * 100) 
              : 0;
            
            return (
              <div key={course.id} className="border dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium dark:text-white">{course.code}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{course.name}</p>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{percentage}%</span>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>{courseCompleted} of {courseAssignments.length} completed</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <button
          onClick={onImport}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Import Course Content
        </button>
      </div>
    </div>
  );
}

// Course Card Component
function CourseCard({ course, isSelected, assignmentCount, onSelect, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ code: course.code, name: course.name });

  const handleSave = () => {
    onEdit(editData);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/30">
        <input
          type="text"
          value={editData.code}
          onChange={(e) => setEditData({ ...editData, code: e.target.value })}
          className="w-full mb-2 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Course Code (e.g., NURS330)"
        />
        <input
          type="text"
          value={editData.name}
          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          className="w-full mb-2 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Course Name"
        />
        <div className="flex space-x-2">
          <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded">
            <Save size={14} />
          </button>
          <button onClick={() => setIsEditing(false)} className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
        isSelected ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate dark:text-white">{course.code}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{course.name}</p>
        </div>
        <div className="flex space-x-1 ml-2">
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {assignmentCount} assignments
      </div>
    </div>
  );
}

// Add Course Modal
function AddCourseModal({ onClose, onAdd }) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    instructor: '',
    semester: 'Spring 2025',
    credits: '3'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.code.trim() && formData.name.trim()) {
      onAdd(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Add New Course</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Course Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., NURS330"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Use official course codes for best results</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Course Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., Nursing of the Childbearing Family"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Instructor</label>
            <input
              type="text"
              value={formData.instructor}
              onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Professor Name"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option>Spring 2025</option>
                <option>Summer 2025</option>
                <option>Fall 2025</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Credits</label>
              <input
                type="number"
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                min="1"
                max="6"
              />
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button onClick={handleSubmit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Add Course
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Import Wizard Component
function ImportWizard({ courses, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [importData, setImportData] = useState({
    courseId: '',
    documentType: '',
    text: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState([]);

  const documentTypes = [
    { id: 'canvas-modules', name: 'Canvas Modules Page', description: 'Copy/paste from Canvas modules page' },
    { id: 'canvas-assignments', name: 'Canvas Assignments Page', description: 'Copy/paste from Canvas assignments list' },
    { id: 'syllabus', name: 'Course Syllabus', description: 'Complete course syllabus document' },
    { id: 'schedule', name: 'Course Schedule/Outline', description: 'Weekly schedule or course outline' },
    { id: 'mixed', name: 'Mixed/Everything', description: 'Parse any type of content (less accurate)' }
  ];

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleParse = async () => {
    setIsLoading(true);
    setProgress([]);
    
    await Promise.resolve(); // Non-blocking
    
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey && importData.documentType !== 'mixed') {
        throw new Error('OpenAI API key not found. Please check your .env.local file.');
      }
      
      const parser = new StudioraDualParser(apiKey);
      const selectedCourse = courses.find(c => c.id === importData.courseId);
      
      const results = await parser.parse(importData.text, {
        course: selectedCourse.code.toLowerCase().replace(/\s+/g, ''),
        documentType: importData.documentType,
        userCourses: courses,
        useAI: apiKey ? true : false
      }, (progressUpdate) => {
        setProgress(prev => [...prev, {
          stage: progressUpdate.stage,
          message: progressUpdate.message,
          timestamp: new Date().toLocaleTimeString()
        }]);
      });
      
      onComplete(results, importData);
    } catch (error) {
      setProgress(prev => [...prev, {
        stage: 'error',
        message: `❌ Parsing failed: ${error.message}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold dark:text-white">Import Course Data</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Step {currentStep} of 3</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex items-center mt-4 space-x-4">
            {[1, 2, 3].map(step => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  step === currentStep ? 'bg-blue-600 text-white' :
                  step < currentStep ? 'bg-green-600 text-white' :
                  'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {step}
                </div>
                {step < 3 && <div className="w-12 h-px bg-gray-300 dark:bg-gray-700 mx-2" />}
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {currentStep === 1 && (
            <div>
              <h3 className="text-lg font-medium mb-4 dark:text-white">Select Course</h3>
              <div className="space-y-3">
                {courses.map(course => (
                  <label key={course.id} className="flex items-center p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="course"
                      value={course.id}
                      checked={importData.courseId === course.id}
                      onChange={(e) => setImportData({ ...importData, courseId: e.target.value })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium dark:text-white">{course.code}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{course.name}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {currentStep === 2 && (
            <div>
              <h3 className="text-lg font-medium mb-4 dark:text-white">What type of document are you importing?</h3>
              <div className="space-y-3">
                {documentTypes.map(type => (
                  <label key={type.id} className="flex items-start p-3 border dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="documentType"
                      value={type.id}
                      checked={importData.documentType === type.id}
                      onChange={(e) => setImportData({ ...importData, documentType: e.target.value })}
                      className="mr-3 mt-1"
                    />
                    <div>
                      <div className="font-medium dark:text-white">{type.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {currentStep === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-4 dark:text-white">Paste Your Content</h3>
                <textarea
                  value={importData.text}
                  onChange={(e) => setImportData({ ...importData, text: e.target.value })}
                  placeholder={`Paste your ${documentTypes.find(t => t.id === importData.documentType)?.name.toLowerCase()} here...`}
                  className="w-full h-64 p-3 border dark:border-gray-700 rounded-lg text-sm font-mono resize-none dark:bg-gray-700 dark:text-white"
                  disabled={isLoading}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {importData.text.length} characters
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4 dark:text-white">Progress</h3>
                <div className="h-64 border dark:border-gray-700 rounded-lg p-3 overflow-y-auto bg-gray-50 dark:bg-gray-900 text-xs font-mono">
                  {progress.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">Progress will appear here...</p>
                  ) : (
                    progress.map((item, idx) => (
                      <div key={idx} className="mb-1">
                        <span className="text-gray-500 dark:text-gray-400">[{item.timestamp}]</span>
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
          )}
        </div>
        
        <div className="p-6 border-t dark:border-gray-700 flex justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          
          <div className="flex space-x-3">
            <button onClick={onClose} className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            
            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !importData.courseId) ||
                  (currentStep === 2 && !importData.documentType)
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleParse}
                disabled={!importData.text.trim() || isLoading}
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
                    <span>Parse Content</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Data Manager Modal
function DataManagerModal({ appData, onClose, onImport, onExport }) {
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/json') {
      setImportFile(file);
      setImportError('');
    } else {
      setImportError('Please select a valid JSON file');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    setImportError('');
    
    try {
      const importedData = await DataManager.importData(importFile);
      onImport(importedData);
    } catch (error) {
      setImportError(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const dataStats = {
    courses: appData.courses.length,
    assignments: appData.assignments.length,
    studyBlocks: appData.studyBlocks.length,
    storageSize: new Blob([JSON.stringify(appData)]).size
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-white">Data Management</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-6">
          <h3 className="font-medium mb-3 dark:text-white">Current Data</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-blue-600">{dataStats.courses}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Courses</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-green-600">{dataStats.assignments}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Assignments</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-purple-600">{dataStats.studyBlocks}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Study Blocks</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-orange-600">{formatBytes(dataStats.storageSize)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Storage Used</div>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="font-medium mb-3 dark:text-white">Export Data</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Download all your data as a backup file. You can import this file later or on another device.
          </p>
          <button
            onClick={onExport}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
          >
            <Download size={16} />
            <span>Export All Data</span>
          </button>
        </div>
        
        <div>
          <h3 className="font-medium mb-3 dark:text-white">Import Data</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Upload a previously exported data file. This will replace all current data.
          </p>
          
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-3">
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="w-full dark:text-gray-300"
              disabled={isImporting}
            />
          </div>
          
          {importError && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {importError}
            </div>
          )}
          
          <button
            onClick={handleImport}
            disabled={!importFile || isImporting}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Import Data File</span>
              </>
            )}
          </button>
        </div>
        
        <div className="mt-6 pt-4 border-t dark:border-gray-700">
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <AlertCircle size={14} />
            <span>Importing will replace all current data. Export first to create a backup.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Course Dashboard Component
function CourseDashboard({ course, assignments, completedAssignments, onToggleAssignment, onImport }) {
  const stats = {
    total: assignments.length,
    completed: assignments.filter(a => completedAssignments.has(a.id)).length,
    dueThisWeek: assignments.filter(a => {
      const dueDate = new Date(a.date);
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return dueDate <= weekFromNow && dueDate >= new Date() && !completedAssignments.has(a.id);
    }).length
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">{course.code}</h2>
            <p className="text-gray-600 dark:text-gray-400">{course.name}</p>
          </div>
          <button
            onClick={onImport}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
          >
            <Upload size={16} />
            <span>Import Data</span>
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-700 dark:text-blue-400">Total Assignments</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-green-700 dark:text-green-400">Completed</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.dueThisWeek}</div>
            <div className="text-sm text-orange-700 dark:text-orange-400">Due This Week</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold dark:text-white">Assignments</h3>
        </div>
        <div className="p-4">
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="mt-2">No assignments imported yet</p>
              <button
                onClick={onImport}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Import course data to get started
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(assignment => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    isCompleted={completedAssignments.has(assignment.id)}
                    onToggle={() => onToggleAssignment(assignment.id)}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Assignment Card Component
function AssignmentCard({ assignment, isCompleted, onToggle }) {
  const isOverdue = new Date(assignment.date) < new Date() && !isCompleted;
  const isDueSoon = !isOverdue && new Date(assignment.date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const getTypeIcon = (type) => {
    const icons = {
      'reading': '📖', 'quiz': '❓', 'exam': '📝', 'assignment': '✏️',
      'discussion': '💬', 'clinical': '🏥', 'lab': '🔬', 'project': '📊',
      'paper': '📄', 'simulation': '🎯', 'preparation': '📚'
    };
    return icons[type] || '📋';
  };

  return (
    <div className={`border rounded-lg p-4 transition-all ${
      isCompleted ? 'bg-gray-50 dark:bg-gray-700/50 opacity-75' : 
      isOverdue ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
      isDueSoon ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
      'bg-white dark:bg-gray-800 hover:shadow-md dark:hover:bg-gray-750'
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
            <span className="text-lg">{getTypeIcon(assignment.type)}</span>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
              {assignment.type}
            </span>
            {assignment.confidence && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(assignment.confidence * 100)}%
              </span>
            )}
          </div>
          
          <h4 className={`font-medium text-sm ${isCompleted ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {assignment.text}
          </h4>
          
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
              {isOverdue ? 'OVERDUE - ' : ''}
              {assignment.date ? `Due: ${new Date(assignment.date).toLocaleDateString()}` : 'No due date'}
            </span>
            {assignment.hours && <span>{assignment.hours}h</span>}
            {assignment.points && <span>{assignment.points} pts</span>}
          </div>
          
          {assignment.source && (
            <div className="mt-1">
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                assignment.source.includes('ai') ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                assignment.source.includes('document-specific') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                assignment.source.includes('regex') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
              }`}>
                {assignment.source}
              </span>
            </div>
          )}
          
          {assignment.extractionReason && (
            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
              💡 {assignment.extractionReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Data View Component
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

export default StudioraNursingPlanner;