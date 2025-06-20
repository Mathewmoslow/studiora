// src/components/Parser/ParserUI.jsx
import React, { useState, useCallback } from 'react';
import { FileText, Upload, Brain, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { DocumentParsers } from '../../services/DocumentParsers';
import { StudioraDualParser } from '../../services/StudioraDualParser';

export function ParserUI({ onParseComplete, isDark }) {
  const [text, setText] = useState('');
  const [selectedType, setSelectedType] = useState('auto');
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState('');
  const [error, setError] = useState(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  
  const documentTypes = [
    { id: 'auto', name: 'Auto-detect', description: 'Automatically detect document type' },
    ...DocumentParsers.getAllParsers()
  ];
  
  const handleParse = useCallback(async () => {
    if (!text.trim()) {
      setError('Please paste some content to parse');
      return;
    }
    
    setIsParsing(true);
    setError(null);
    setParsingStatus('Starting parser...');
    
    try {
      // Auto-detect type if needed
      let docType = selectedType;
      if (docType === 'auto') {
        docType = DocumentParsers.detectDocumentType(text);
        setParsingStatus(`Detected: ${docType} format`);
      }
      
      // Create parser
      const parser = new StudioraDualParser(
        process.env.VITE_OPENAI_API_KEY
      );
      
      // Parse with progress updates
      const results = await parser.parse(text, {
        documentType: docType,
        course: null // Will be inferred from text
      }, (progress) => {
        setParsingStatus(progress.message);
      });
      
      // Success
      setParsingStatus('Parsing complete!');
      if (onParseComplete) {
        onParseComplete(results);
      }
      
      // Clear input after successful parse
      setTimeout(() => {
        setText('');
        setParsingStatus('');
        setIsParsing(false);
      }, 1500);
      
    } catch (err) {
      console.error('Parsing error:', err);
      setError(err.message || 'Failed to parse content');
      setIsParsing(false);
      setParsingStatus('');
    }
  }, [text, selectedType, onParseComplete]);
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setText(e.target.result);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 sm:p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Parse Course Content
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Paste content from Canvas, Sherpath, or upload a syllabus
        </p>
      </div>
      
      {/* Document Type Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Document Type
        </label>
        <div className="relative">
          <button
            onClick={() => setShowTypeSelector(!showTypeSelector)}
            className="w-full px-4 py-2 text-left bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <span className="text-gray-900 dark:text-white">
              {documentTypes.find(t => t.id === selectedType)?.name || 'Select type'}
            </span>
            <ChevronDown className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${showTypeSelector ? 'rotate-180' : ''}`} />
          </button>
          
          {showTypeSelector && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {documentTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedType(type.id);
                    setShowTypeSelector(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${
                    selectedType === type.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {type.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Text Input Area */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Content to Parse
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your Canvas content, Sherpath course plan, or syllabus text here..."
          className="w-full h-48 px-4 py-3 border dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          disabled={isParsing}
        />
      </div>
      
      {/* File Upload Option */}
      <div className="mb-4">
        <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
          <input
            type="file"
            accept=".txt,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isParsing}
          />
          <Upload className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Or upload a file
          </span>
        </label>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}
      
      {/* Parsing Status */}
      {parsingStatus && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center">
          {isParsing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent mr-2" />
          ) : (
            <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
          )}
          <span className="text-sm text-blue-700 dark:text-blue-300">{parsingStatus}</span>
        </div>
      )}
      
      {/* Parse Button */}
      <button
        onClick={handleParse}
        disabled={isParsing || !text.trim()}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center ${
          isParsing || !text.trim()
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
        }`}
      >
        {isParsing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
            Parsing...
          </>
        ) : (
          <>
            <Brain className="h-5 w-5 mr-2" />
            Parse Content
          </>
        )}
      </button>
      
      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>• Auto-detect works with most Canvas and Sherpath formats</p>
        <p>• For best results, select the specific document type</p>
        <p>• All parsing happens locally - your data stays private</p>
      </div>
    </div>
  );
}

// Mobile-optimized assignment results display
export function ParsedAssignmentsList({ assignments, onToggleComplete, isDark }) {
  const getTypeColor = (type) => {
    const colors = {
      exam: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
      quiz: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
      assignment: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
      reading: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
      video: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
      clinical: 'bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400',
      lab: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
    };
    
    return colors[type] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400';
  };
  
  const getTypeIcon = (type) => {
    const icons = {
      exam: '📝',
      quiz: '❓',
      assignment: '📋',
      reading: '📚',
      video: '🎥',
      clinical: '🏥',
      lab: '🧪',
      discussion: '💬',
      project: '🎯'
    };
    
    return icons[type] || '📄';
  };
  
  if (!assignments || assignments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No assignments found
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {assignments.map((assignment) => {
        const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date();
        const isDueSoon = assignment.dueDate && 
          new Date(assignment.dueDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        
        return (
          <div
            key={assignment.id}
            className={`p-4 rounded-lg border transition-all ${
              assignment.completed ? 'bg-gray-50 dark:bg-gray-700/50 opacity-75' :
              isOverdue ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
              isDueSoon ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
              'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-1">{getTypeIcon(assignment.type)}</span>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeColor(assignment.type)}`}>
                    {assignment.type}
                  </span>
                  {assignment.points > 0 && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {assignment.points} pts
                    </span>
                  )}
                  {assignment.confidence && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {Math.round(assignment.confidence * 100)}%
                    </span>
                  )}
                </div>
                
                <h4 className={`font-medium text-gray-900 dark:text-white ${
                  assignment.completed ? 'line-through' : ''
                }`}>
                  {assignment.title}
                </h4>
                
                {assignment.dueDate && (
                  <p className={`text-sm mt-1 ${
                    isOverdue ? 'text-red-600 dark:text-red-400 font-medium' :
                    isDueSoon ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {isOverdue && 'OVERDUE - '}
                    Due: {new Date(assignment.dueDate).toLocaleDateString()} 
                    {assignment.dueTime && ` at ${assignment.dueTime}`}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {assignment.module && (
                    <span className="text-gray-600 dark:text-gray-400">
                      Module {assignment.module}
                    </span>
                  )}
                  {assignment.estimatedHours && (
                    <span className="text-gray-600 dark:text-gray-400">
                      ~{assignment.estimatedHours}h
                    </span>
                  )}
                  {assignment.source && (
                    <span className="text-gray-500 dark:text-gray-500">
                      via {assignment.source}
                    </span>
                  )}
                </div>
              </div>
              
              {onToggleComplete && (
                <button
                  onClick={() => onToggleComplete(assignment.id)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {assignment.completed ? (
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 dark:border-gray-600 rounded" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}