import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Settings, Upload, Sparkles, Clock, Target, AlertCircle } from 'lucide-react';
import './App.css';

// Main Studiora App
function StudioraNursingPlanner() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [modules, setModules] = useState({});
  const [showParser, setShowParser] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [completedAssignments, setCompletedAssignments] = useState(new Set());

  // Sample data to demonstrate the app
  const sampleAssignments = [
    {
      id: '1',
      text: 'Chapter 1-3 Reading: Women\'s Health Fundamentals',
      date: '2025-05-11',
      type: 'reading',
      hours: 2.5,
      course: 'obgyn',
      source: 'regex-primary',
      confidence: 0.95
    },
    {
      id: '2', 
      text: 'Discussion Preparation: Fetal Development',
      date: '2025-05-12',
      type: 'preparation',
      hours: 1,
      course: 'obgyn',
      source: 'ai-unique',
      confidence: 0.88,
      extractionReason: 'AI detected implicit assignment from "come prepared to discuss"'
    },
    {
      id: '3',
      text: 'Module 1 Quiz: Cardiovascular Assessment',
      date: '2025-05-14',
      type: 'quiz',
      hours: 1.5,
      course: 'adulthealth',
      source: 'reconciled-ai',
      confidence: 0.92
    }
  ];

  useEffect(() => {
    setAssignments(sampleAssignments);
  }, []);

  const handleParseComplete = (parseResults) => {
    setAssignments(parseResults.assignments || []);
    setModules(parseResults.modules || {});
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Studiora
                </h1>
              </div>
              <span className="text-sm text-gray-500 font-medium">
                Intelligent Nursing Schedule Planner
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Week {currentWeek} • Spring 2025
              </span>
              <button
                onClick={() => setShowParser(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload size={16} />
                <span>Import Course</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Panel - Assignments */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <BookOpen className="mr-2 h-5 w-5 text-blue-600" />
                  Week {currentWeek} Assignments
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {assignments.length} assignments • {completedAssignments.size} completed
                </p>
              </div>
              
              <div className="p-6 space-y-4">
                {assignments.length === 0 ? (
                  <StudioraWelcomeCard onImport={() => setShowParser(true)} />
                ) : (
                  assignments.map((assignment) => (
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

          {/* Right Panel - Calendar & Analytics */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AnalyticsCard
                title="Study Hours"
                value="12.5"
                subtitle="This week"
                icon={Clock}
                color="blue"
              />
              <AnalyticsCard
                title="Completion Rate"
                value="78%"
                subtitle="Overall progress"
                icon={Target}
                color="green"
              />
              <AnalyticsCard
                title="Upcoming Exams"
                value="2"
                subtitle="Next 7 days"
                icon={AlertCircle}
                color="orange"
              />
            </div>

            {/* Calendar Placeholder */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-blue-600" />
                  Schedule Overview
                </h2>
              </div>
              <div className="p-6">
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4">Calendar integration coming soon</p>
                  <p className="text-sm">Import your course documents to see assignments plotted on the calendar</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parser Modal */}
      {showParser && (
        <StudioraParserModal
          onClose={() => setShowParser(false)}
          onComplete={handleParseComplete}
        />
      )}
    </div>
  );
}

// Welcome Card Component
function StudioraWelcomeCard({ onImport }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="flex justify-center mb-4">
        <div className="p-3 bg-blue-100 rounded-full">
          <Sparkles className="h-8 w-8 text-blue-600" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Welcome to Studiora!
      </h3>
      <p className="text-gray-600 mb-6 text-sm leading-relaxed">
        Get started by importing your course syllabus or assignment list. 
        Studiora's AI will intelligently parse your content and create a 
        personalized study schedule.
      </p>
      <button
        onClick={onImport}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
      >
        <Upload size={16} />
        <span>Import Your First Course</span>
      </button>
      
      <div className="mt-6 text-xs text-gray-500">
        <p>✨ Powered by dual AI + regex parsing for maximum accuracy</p>
      </div>
    </div>
  );
}

// Assignment Card Component  
function AssignmentCard({ assignment, isCompleted, onToggle }) {
  const getSourceBadge = (source) => {
    if (source?.includes('ai')) {
      return { text: 'AI Enhanced', color: 'bg-purple-100 text-purple-700' };
    } else if (source?.includes('reconciled')) {
      return { text: 'AI Verified', color: 'bg-green-100 text-green-700' };
    }
    return { text: 'Detected', color: 'bg-gray-100 text-gray-600' };
  };

  const getCourseColor = (course) => {
    const colors = {
      'obgyn': 'bg-blue-100 text-blue-800',
      'adulthealth': 'bg-green-100 text-green-800', 
      'nclex': 'bg-purple-100 text-purple-800',
      'geronto': 'bg-orange-100 text-orange-800'
    };
    return colors[course] || 'bg-gray-100 text-gray-800';
  };

  const sourceBadge = getSourceBadge(assignment.source);

  return (
    <div className={`border rounded-lg p-4 transition-all hover:shadow-md ${
      isCompleted ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-blue-300'
    }`}>
      <div className="flex items-start space-x-3">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={onToggle}
          className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <p className={`text-sm font-medium ${
              isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
            }`}>
              {assignment.text}
            </p>
          </div>
          
          <div className="mt-2 flex items-center space-x-2 text-xs">
            <span className={`px-2 py-1 rounded-full ${getCourseColor(assignment.course)}`}>
              {assignment.course?.toUpperCase()}
            </span>
            <span className={`px-2 py-1 rounded-full ${sourceBadge.color}`}>
              {sourceBadge.text}
            </span>
            <span className="text-gray-500">
              Due {new Date(assignment.date).toLocaleDateString()}
            </span>
            <span className="text-gray-500">
              {assignment.hours}h
            </span>
          </div>

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

// Analytics Card Component
function AnalyticsCard({ title, value, subtitle, icon: Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600', 
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="ml-4">
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// Simplified Parser Modal (placeholder for full implementation)
function StudioraParserModal({ onClose, onComplete }) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleParse = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    setStatus('Parsing with Studiora\'s dual AI + regex system...');
    
    // Simulate parsing process
    setTimeout(() => {
      setStatus('✅ Found 8 assignments, 2 AI-enhanced');
      setTimeout(() => {
        onComplete({
          assignments: [
            {
              id: 'parsed-1',
              text: 'Maternal Health Assessment Reading',
              date: '2025-05-15',
              type: 'reading',
              hours: 2,
              course: 'obgyn',
              source: 'regex-primary',
              confidence: 0.94
            },
            {
              id: 'parsed-2',
              text: 'Clinical Prep: Patient Interview Techniques',
              date: '2025-05-16', 
              type: 'preparation',
              hours: 1.5,
              course: 'obgyn',
              source: 'ai-unique',
              confidence: 0.87,
              extractionReason: 'AI inferred from "come ready to practice interviews"'
            }
          ]
        });
        setIsLoading(false);
      }, 1000);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              Import Course Content
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Paste your syllabus, Canvas page, or assignment list
          </p>
        </div>
        
        <div className="p-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your course content here... Studiora will intelligently extract all assignments, dates, and requirements using advanced AI parsing."
            className="w-full h-48 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          {status && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">{status}</p>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
                <Sparkles size={16} />
                <span>Parse with Studiora AI</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudioraNursingPlanner;
