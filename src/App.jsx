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

// Main App Component
function StudioraNursingPlanner() {
  const [appData, setAppData] = useState(DataManager.loadData());
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showDataManager, setShowDataManager] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [completedAssignments, setCompletedAssignments] = useState(new Set());

  // Auto-save when data changes
  useEffect(() => {
    DataManager.saveData(appData);
  }, [appData]);

  // Select first course by default
  useEffect(() => {
    if (!selectedCourse && appData.courses.length > 0) {
      setSelectedCourse(appData.courses[0]);
    }
  }, [appData.courses, selectedCourse]);

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

  const courseAssignments = selectedCourse 
    ? appData.assignments.filter(a => a.courseId === selectedCourse.id)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold">Studiora</h1>
                <p className="text-xs text-gray-500">Intelligent Course Management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <nav className="hidden md:flex space-x-2">
                {['dashboard', 'calendar', 'data'].map(view => (
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
                onClick={() => setShowDataManager(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                title="Data Management"
              >
                <Settings size={18} />
              </button>
              
              <button
                onClick={() => setShowImportWizard(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2"
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
              <BookOpen className="mx-auto h-16 w-16 text-gray-300" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900">Welcome to Studiora!</h2>
              <p className="mt-2 text-gray-600">
                Start by adding your first course to begin organizing your assignments and schedule.
              </p>
              <button
                onClick={() => setShowAddCourse(true)}
                className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto"
              >
                <Plus size={20} />
                <span>Add Your First Course</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold">My Courses</h2>
                  <button
                    onClick={() => setShowAddCourse(true)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Add Course"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                
                <div className="space-y-2">
                  {appData.courses.map(course => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      isSelected={selectedCourse?.id === course.id}
                      assignmentCount={appData.assignments.filter(a => a.courseId === course.id).length}
                      onSelect={() => setSelectedCourse(course)}
                      onEdit={(updates) => updateCourse(course.id, updates)}
                      onDelete={() => deleteCourse(course.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              {selectedCourse ? (
                currentView === 'dashboard' ? (
                  <CourseDashboard
                    course={selectedCourse}
                    assignments={courseAssignments}
                    completedAssignments={completedAssignments}
                    onToggleAssignment={toggleAssignment}
                    onImport={() => setShowImportWizard(true)}
                  />
                ) : currentView === 'calendar' ? (
                  <CalendarView
                    course={selectedCourse}
                    assignments={courseAssignments}
                    studyBlocks={appData.studyBlocks.filter(s => s.courseId === selectedCourse.id)}
                    calendarEvents={appData.calendarEvents?.filter(e => e.courseId === selectedCourse.id) || []}
                    onUpdateAssignment={updateAssignment}
                    onAddAssignment={addAssignment}
                  />
                ) : (
                  <DataView appData={appData} />
                )
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-600">Select a course to view its content</p>
                </div>
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
      <div className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50">
        <input
          type="text"
          value={editData.code}
          onChange={(e) => setEditData({ ...editData, code: e.target.value })}
          className="w-full mb-2 px-2 py-1 text-sm border rounded"
          placeholder="Course Code (e.g., NURS330)"
        />
        <input
          type="text"
          value={editData.name}
          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          className="w-full mb-2 px-2 py-1 text-sm border rounded"
          placeholder="Course Name"
        />
        <div className="flex space-x-2">
          <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-100 rounded">
            <Save size={14} />
          </button>
          <button onClick={() => setIsEditing(false)} className="p-1 text-gray-600 hover:bg-gray-100 rounded">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
        isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{course.code}</h3>
          <p className="text-xs text-gray-600 truncate">{course.name}</p>
        </div>
        <div className="flex space-x-1 ml-2">
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      
      <div className="text-xs text-gray-500">
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
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add New Course</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Course Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., NURS330"
            />
            <p className="text-xs text-gray-500 mt-1">Use official course codes for best results</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Course Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., Nursing of the Childbearing Family"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Instructor</label>
            <input
              type="text"
              value={formData.instructor}
              onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Professor Name"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option>Spring 2025</option>
                <option>Summer 2025</option>
                <option>Fall 2025</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Credits</label>
              <input
                type="number"
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                min="1"
                max="6"
              />
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
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
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Import Course Data</h2>
              <p className="text-sm text-gray-600">Step {currentStep} of 3</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex items-center mt-4 space-x-4">
            {[1, 2, 3].map(step => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  step === currentStep ? 'bg-blue-600 text-white' :
                  step < currentStep ? 'bg-green-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 3 && <div className="w-12 h-px bg-gray-300 mx-2" />}
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-6">
          {currentStep === 1 && (
            <div>
              <h3 className="text-lg font-medium mb-4">Select Course</h3>
              <div className="space-y-3">
                {courses.map(course => (
                  <label key={course.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="course"
                      value={course.id}
                      checked={importData.courseId === course.id}
                      onChange={(e) => setImportData({ ...importData, courseId: e.target.value })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">{course.code}</div>
                      <div className="text-sm text-gray-600">{course.name}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {currentStep === 2 && (
            <div>
              <h3 className="text-lg font-medium mb-4">What type of document are you importing?</h3>
              <div className="space-y-3">
                {documentTypes.map(type => (
                  <label key={type.id} className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="documentType"
                      value={type.id}
                      checked={importData.documentType === type.id}
                      onChange={(e) => setImportData({ ...importData, documentType: e.target.value })}
                      className="mr-3 mt-1"
                    />
                    <div>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-sm text-gray-600">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {currentStep === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Paste Your Content</h3>
                <textarea
                  value={importData.text}
                  onChange={(e) => setImportData({ ...importData, text: e.target.value })}
                  placeholder={`Paste your ${documentTypes.find(t => t.id === importData.documentType)?.name.toLowerCase()} here...`}
                  className="w-full h-64 p-3 border rounded-lg text-sm font-mono resize-none"
                  disabled={isLoading}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {importData.text.length} characters
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4">Progress</h3>
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
          )}
        </div>
        
        <div className="p-6 border-t flex justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          
          <div className="flex space-x-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
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
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Data Management</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-6">
          <h3 className="font-medium mb-3">Current Data</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-2xl font-bold text-blue-600">{dataStats.courses}</div>
              <div className="text-sm text-gray-600">Courses</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-2xl font-bold text-green-600">{dataStats.assignments}</div>
              <div className="text-sm text-gray-600">Assignments</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-2xl font-bold text-purple-600">{dataStats.studyBlocks}</div>
              <div className="text-sm text-gray-600">Study Blocks</div>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-2xl font-bold text-orange-600">{formatBytes(dataStats.storageSize)}</div>
              <div className="text-sm text-gray-600">Storage Used</div>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="font-medium mb-3">Export Data</h3>
          <p className="text-sm text-gray-600 mb-3">
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
          <h3 className="font-medium mb-3">Import Data</h3>
          <p className="text-sm text-gray-600 mb-3">
            Upload a previously exported data file. This will replace all current data.
          </p>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-3">
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="w-full"
              disabled={isImporting}
            />
          </div>
          
          {importError && (
            <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
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
        
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold">{course.code}</h2>
            <p className="text-gray-600">{course.name}</p>
          </div>
          <button
            onClick={onImport}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Upload size={16} />
            <span>Import Data</span>
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-700">Total Assignments</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-green-700">Completed</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.dueThisWeek}</div>
            <div className="text-sm text-orange-700">Due This Week</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Assignments</h3>
        </div>
        <div className="p-4">
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
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
            <span className="text-lg">{getTypeIcon(assignment.type)}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {assignment.type}
            </span>
            {assignment.confidence && (
              <span className="text-xs text-gray-500">
                {Math.round(assignment.confidence * 100)}%
              </span>
            )}
          </div>
          
          <h4 className={`font-medium text-sm ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
            {assignment.text}
          </h4>
          
          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
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
                assignment.source.includes('ai') ? 'bg-purple-100 text-purple-700' :
                assignment.source.includes('document-specific') ? 'bg-green-100 text-green-700' :
                assignment.source.includes('regex') ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {assignment.source}
              </span>
            </div>
          )}
          
          {assignment.extractionReason && (
            <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Data Overview</h2>
      <div className="space-y-4">
        <div>
          <h3 className="font-medium">Courses ({appData.courses.length})</h3>
          <div className="mt-2 space-y-1">
            {appData.courses.map(course => (
              <div key={course.id} className="text-sm text-gray-600">
                {course.code} - {course.name}
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="font-medium">Recent Parsing History</h3>
          <div className="mt-2 space-y-1">
            {appData.parsingHistory.slice(-5).map(history => (
              <div key={history.id} className="text-sm text-gray-600">
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