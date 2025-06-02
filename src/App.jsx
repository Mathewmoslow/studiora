cat > src/App.jsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Settings, Upload, Sparkles, Clock, Target, AlertCircle, Brain, Zap } from 'lucide-react';
import './App.css';
import { StudioraDualParser } from './services/StudioraDualParser';

function StudioraNursingPlanner() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [assignments, setAssignments] = useState([]);
  const [completedAssignments, setCompletedAssignments] = useState(new Set());
  const [showParser, setShowParser] = useState(false);
  const [parsingResults, setParsingResults] = useState(null);

  // Load saved data
  useEffect(() => {
    const saved = localStorage.getItem('studiora_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setAssignments(data.assignments || []);
        setCompletedAssignments(new Set(data.completed || []));
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
      parsingResults,
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('studiora_data', JSON.stringify(data));
  }, [assignments, completedAssignments, parsingResults]);

  const handleParseComplete = (results) => {
    setAssignments(results.assignments || []);
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

  const clearData = () => {
    if (confirm('Clear all data and start fresh?')) {
      setAssignments([]);
      setCompletedAssignments(new Set());
      setParsingResults(null);
      localStorage.removeItem('studiora_data');
    }
  };

  const completionRate = assignments.length > 0 ? 
    Math.round((completedAssignments.size / assignments.length) * 100) : 0;
    
  const totalHours = assignments.reduce((sum, a) => sum + (a.hours || 0), 0);
  const upcomingAssignments = assignments.filter(a => 
    new Date(a.date) >= new Date() && !completedAssignments.has(a.id)
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
                onClick={clearData}
                className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200"
              >
                Clear Data
              </button>
              <button
                onClick={() => setShowParser(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload size={16} />
                <span>Import Course Data</span>
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
                  Assignments ({assignments.length})
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {completedAssignments.size} completed • {upcomingAssignments} upcoming
                </p>
                
                {parsingResults?.metadata && (
                  <div className="mt-3 text-xs bg-blue-50 p-2 rounded">
                    <div className="flex items-center space-x-1">
                      <Brain size={12} className="text-blue-600" />
                      <span className="font-medium">Parsed via {parsingResults.metadata.method}</span>
                    </div>
                    <div className="text-blue-600">
                      Confidence: {Math.round((parsingResults.metadata.confidence || 0) * 100)}%
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                {assignments.length === 0 ? (
                  <WelcomeCard onImport={() => setShowParser(true)} />
                ) : (
                  assignments
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((assignment) => (
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

          {/* Right Panel - Analytics & Schedule */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatsCard
                title="Study Hours"
                value={totalHours.toFixed(1)}
                subtitle="Total estimated"
                icon={Clock}
                color="blue"
              />
              <StatsCard
                title="Completion"
                value={`${completionRate}%`}
                subtitle="Overall progress"
                icon={Target}
                color="green"
              />
              <StatsCard
                title="Upcoming"
                value={upcomingAssignments}
                subtitle="Due soon"
                icon={AlertCircle}
                color="orange"
              />
            </div>

            {/* Assignment Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-blue-600" />
                  Assignment Timeline
                </h2>
              </div>
              <div className="p-6">
                {assignments.length > 0 ? (
                  <AssignmentTimeline 
                    assignments={assignments}
                    completed={completedAssignments}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-4">No assignments imported yet</p>
                    <p className="text-sm">Import your nursing course data to see the timeline</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parser Modal */}
      {showParser && (
        <StudioraDualParserModal
          onClose={() => setShowParser(false)}
          onComplete={handleParseComplete}
        />
      )}
    </div>
  );
}

function WelcomeCard({ onImport }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="flex justify-center mb-4">
        <div className="p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
          <Brain className="h-8 w-8 text-blue-600" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Ready to Parse Your Nursing Courses
      </h3>
      <p className="text-gray-600 mb-6 text-sm leading-relaxed">
        Import your complete nursing program database. Studiora will use 
        dual AI + regex parsing to extract every assignment, exam, and deadline.
      </p>
      <button
        onClick={onImport}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center space-x-2 mx-auto"
      >
        <Brain size={16} />
        <span>Start Parsing</span>
      </button>
      
      <div className="mt-6 text-xs text-gray-500">
        <p>✨ Powered by StudioraDualParser: Independent Regex + AI + Intelligent Reconciliation</p>
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, isCompleted, onToggle }) {
  const getSourceBadge = (source) => {
    if (source?.includes('ai-unique')) {
      return { text: 'AI Found', color: 'bg-purple-100 text-purple-700', icon: Brain };
    } else if (source?.includes('reconciled')) {
      return { text: 'AI+Regex', color: 'bg-green-100 text-green-700', icon: Zap };
    } else if (source?.includes('regex')) {
      return { text: 'Regex', color: 'bg-blue-100 text-blue-700', icon: null };
    }
    return { text: 'Detected', color: 'bg-gray-100 text-gray-600', icon: null };
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

  const getTypeColor = (type) => {
    const colors = {
      'exam': 'bg-red-100 text-red-800',
      'quiz': 'bg-yellow-100 text-yellow-800',
      'reading': 'bg-blue-100 text-blue-800',
      'video': 'bg-purple-100 text-purple-800',
      'assignment': 'bg-green-100 text-green-800',
      'clinical': 'bg-teal-100 text-teal-800',
      'simulation': 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const sourceBadge = getSourceBadge(assignment.source);
  const isOverdue = new Date(assignment.date) < new Date() && !isCompleted;
  const isDueSoon = !isOverdue && new Date(assignment.date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className={`border rounded-lg p-4 transition-all hover:shadow-md ${
      isCompleted ? 'bg-gray-50 border-gray-200 opacity-75' : 
      isOverdue ? 'bg-red-50 border-red-200' :
      isDueSoon ? 'bg-yellow-50 border-yellow-200' :
      'bg-white border-gray-200 hover:border-blue-300'
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
          
          <div className="mt-2 flex items-center space-x-2 text-xs flex-wrap gap-1">
            <span className={`px-2 py-1 rounded-full ${getCourseColor(assignment.course)}`}>
              {assignment.course?.toUpperCase()}
            </span>
            <span className={`px-2 py-1 rounded-full ${getTypeColor(assignment.type)}`}>
              {assignment.type?.toUpperCase()}
            </span>
            <div className={`px-2 py-1 rounded-full flex items-center space-x-1 ${sourceBadge.color}`}>
              {sourceBadge.icon && <sourceBadge.icon size={10} />}
              <span>{sourceBadge.text}</span>
            </div>
            <span className={`${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              {isOverdue ? 'OVERDUE' : new Date(assignment.date).toLocaleDateString()}
            </span>
            <span className="text-gray-500">
              {assignment.hours}h
            </span>
            {assignment.confidence && (
              <span className="text-gray-400">
                {Math.round(assignment.confidence * 100)}%
              </span>
            )}
          </div>

          {assignment.extractionReason && (
            <div className="mt-2 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
              🧠 {assignment.extractionReason}
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

function AssignmentTimeline({ assignments, completed }) {
  const upcoming = assignments
    .filter(a => new Date(a.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 10);

  if (upcoming.length === 0) {
    return <div className="text-gray-500">No upcoming assignments</div>;
  }

  return (
    <div className="space-y-3">
      {upcoming.map(assignment => {
        const isCompleted = completed.has(assignment.id);
        const daysUntil = Math.ceil((new Date(assignment.date) - new Date()) / (1000 * 60 * 60 * 24));
        
        return (
          <div key={assignment.id} className={`flex items-center justify-between p-3 rounded-lg ${
            isCompleted ? 'bg-gray-50' : daysUntil <= 3 ? 'bg-yellow-50' : 'bg-blue-50'
          }`}>
            <div className="flex-1">
              <h4 className={`font-medium text-sm ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {assignment.text}
              </h4>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-gray-500">
                  {assignment.course?.toUpperCase()} • {assignment.type}
                </span>
                <span className="text-xs text-gray-500">
                  {assignment.hours}h
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${
                daysUntil <= 0 ? 'text-red-600' : 
                daysUntil <= 3 ? 'text-orange-600' : 'text-gray-600'
              }`}>
                {daysUntil <= 0 ? 'Due today' : 
                 daysUntil === 1 ? 'Tomorrow' : 
                 `${daysUntil} days`}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(assignment.date).toLocaleDateString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Real StudioraDualParser Modal - Production Implementation
function StudioraDualParserModal({ onClose, onComplete }) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState([]);
  const [results, setResults] = useState(null);

  const addProgress = (message, stage = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setProgress(prev => [...prev, { timestamp, stage, message }]);
  };

  const handleParse = async () => {
    if (!text.trim()) {
      setError('Please paste your nursing course database');
      return;
    }
    
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('your-openai-api-key')) {
      setError('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env.local');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setProgress([]);
    setResults(null);
    setStatus('🎓 Initializing StudioraDualParser...');
    
    try {
      addProgress('Creating StudioraDualParser instance', 'init');
      
      const parser = new StudioraDualParser(apiKey, {
        model: import.meta.env.VITE_AI_MODEL || 'gpt-4o',
        timeout: parseInt(import.meta.env.VITE_AI_TIMEOUT) || 60000
      });
      
      addProgress('Starting dual parsing: Regex + AI independent analysis', 'start');
      
      const finalResults = await parser.parse(text, 'auto', (progressUpdate) => {
        setStatus(progressUpdate.message || 'Processing...');
        addProgress(progressUpdate.message, progressUpdate.stage);
      });
      
      addProgress(`✅ Parsing complete! Method: ${finalResults.metadata.method}`, 'success');
      addProgress(`📊 Found ${finalResults.assignments.length} assignments`, 'success');
      addProgress(`🎯 Confidence: ${Math.round((finalResults.metadata.confidence || 0) * 100)}%`, 'success');
      
      setResults(finalResults);
      setStatus(`✅ SUCCESS: ${finalResults.assignments.length} assignments found via ${finalResults.metadata.method}`);
      
      // Auto-complete after 2 seconds
      setTimeout(() => {
        onComplete(finalResults);
      }, 2000);
      
    } catch (error) {
      const errorMsg = `❌ Parsing failed: ${error.message}`;
      addProgress(errorMsg, 'error');
      setError(errorMsg);
      setStatus('❌ Parsing failed');
      console.error('StudioraDualParser error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Brain className="mr-2 h-6 w-6 text-blue-600" />
                StudioraDualParser
              </h2>
              <p className="text-sm text-gray-600">
                Independent Regex + AI parsing with intelligent reconciliation
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div>
            <h3 className="font-medium mb-2 flex items-center">
              <Upload className="mr-2 h-4 w-4" />
              Course Database Input
            </h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your complete nursing course database here..."
              className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
              disabled={isLoading}
            />
            <div className="text-xs text-gray-500 mt-2">
              Characters: {text.length.toLocaleString()}
            </div>
          </div>
          
          {/* Progress Section */}
          <div>
            <h3 className="font-medium mb-2 flex items-center">
              <Zap className="mr-2 h-4 w-4" />
              Parsing Progress
            </h3>
            <div className="h-64 border border-gray-300 rounded-lg p-4 overflow-y-auto bg-gray-50 font-mono text-xs">
              {progress.length === 0 ? (
                <p className="text-gray-500">Progress will appear here...</p>
              ) : (
                progress.map((item, index) => (
                  <div key={index} className={`mb-2 ${
                    item.stage === 'error' ? 'text-red-600' :
                    item.stage === 'success' ? 'text-green-600' :
                    'text-gray-700'
                  }`}>
                    <span className="text-gray-500">{item.timestamp}</span>
                    <span className="ml-2">[{item.stage}]</span>
                    <span className="ml-2">{item.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Status and Results */}
        <div className="px-6">
          {status && (
            <div className={`mb-4 p-3 rounded-lg ${
              status.includes('SUCCESS') ? 'bg-green-50 border border-green-200' :
              status.includes('failed') ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <p className={`text-sm ${
                status.includes('SUCCESS') ? 'text-green-800' :
                status.includes('failed') ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {status}
              </p>
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          {results && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-green-800 text-sm">
                <div className="font-medium">Parsing Complete!</div>
                <div>Method: {results.metadata.method}</div>
                <div>Assignments: {results.assignments.length}</div>
                <div>Confidence: {Math.round((results.metadata.confidence || 0) * 100)}%</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {results ? 'Close' : 'Cancel'}
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
EOF