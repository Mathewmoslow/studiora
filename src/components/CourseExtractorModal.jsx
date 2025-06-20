import React, { useState } from 'react';
import { Brain, Copy, FileText, Check, Download, Trash2, Upload, X, ClipboardPaste, AlertCircle, ChevronRight } from 'lucide-react';

const STUDIORA_EXTRACTION_PROMPT = `Identify all the unique items as part of this course including but not limited to assignments projects tests quizzes presentations chapter readings videos powerpoints to review pre recorded lectures supplemental materials to review things classified as prework simulations class time clinical time and any other requirement of the course both for a grade and not for a grade.`;
// Modal wrapper component
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}

// Course Extractor Modal
function CourseExtractorModal({ isOpen, onClose, onExtractComplete, courses }) {
  const [inputText, setInputText] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [editedItem, setEditedItem] = useState(null);
  const [error, setError] = useState('');
  const [inputMethod, setInputMethod] = useState('paste');
  const [selectedCourse, setSelectedCourse] = useState(courses?.[0]?.id || '');

  // Extract using Studiora processing
  const extractWithStudiora = async (text) => {
    setIsExtracting(true);
    setError('');

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      setError('OpenAI API key not configured in environment');
      setIsExtracting(false);
      return;
    }

    // More robust system prompt
    const systemPrompt = `You are Studiora's intelligent course parser. Extract ALL course items and return ONLY valid JSON.

CRITICAL RULES:
1. Return ONLY the JSON object, no other text before or after
2. Start your response with { and end with }
3. No markdown formatting, no code blocks, no explanations
4. Ensure all JSON is properly formatted with commas between array items
5. All dates must be in YYYY-MM-DD format or null
6. All string values must be properly escaped
7. Numbers must not have quotes

Return this EXACT structure:
{
  "assignments": [
    {
      "id": "unique_id",
      "text": "description",
      "date": "YYYY-MM-DD or null",
      "type": "one of: assignment|quiz|exam|reading|video|clinical|simulation|presentation|discussion|class|powerpoint|lecture|lab|project|other",
      "hours": 1.5,
      "course": "${selectedCourse || 'course_code'}",
      "category": "optional category or omit",
      "confidence": 0.8,
      "source": "studiora-extracted"
    }
  ],
  "metadata": {
    "extractionDate": "${new Date().toISOString()}",
    "totalItems": 0,
    "confidence": 0.8,
    "model": "gpt-4o",
    "prompt": "extraction"
  }
}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Using gpt-4o for better performance and JSON compliance
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${STUDIORA_EXTRACTION_PROMPT}\n\nDocument content:\n${text.substring(0, 12000)}` } // Limit input to avoid token limits
          ],
          temperature: 0.1,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(errorData.error?.message || 'Studiora processing failed');
      }

      const data = await response.json();
      let content = data.choices[0].message.content;

      // Simple parsing with basic fixes
      let result;
      try {
        // Remove any markdown formatting
        content = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

        // Parse the JSON
        result = JSON.parse(content);

        // Verify it has the expected structure
        if (!result.assignments || !Array.isArray(result.assignments)) {
          throw new Error('Missing assignments array');
        }

      } catch (parseError) {
        console.error('JSON parse failed:', parseError);

        // Simple fallback - create the expected structure
        result = {
          assignments: [],
          metadata: {
            extractionDate: new Date().toISOString(),
            totalItems: 0,
            confidence: 0.5,
            model: 'gpt-4o',
            error: 'Parse failed - created empty structure'
          }
        };

        // Try to extract at least the assignment texts
        const textMatches = content.matchAll(/"text"\s*:\s*"([^"]+)"/g);
        for (const match of textMatches) {
          result.assignments.push({
            id: `schedule_${Date.now()}_${result.assignments.length}`,
            text: match[1],
            type: 'assignment',
            hours: 1.5,
            course: selectedCourse,
            source: 'studiora-extracted'
          });
        }
      }

      // Quick validation of assignments
      result.assignments = result.assignments.map((item, idx) => ({
        id: item.id || `schedule_${Date.now()}_${idx}`,
        text: String(item.text || 'Untitled'),
        date: item.date || null,
        type: item.type || 'assignment',
        hours: Number(item.hours) || 1.5,
        course: selectedCourse || item.course || 'unknown',
        confidence: Number(item.confidence) || 0.8,
        source: 'studiora-extracted'
      }));

      // Update metadata
      result.metadata = {
        ...result.metadata,
        totalItems: result.assignments.length
      };

      setExtractedData(result);

    } catch (err) {
      setError(`Extraction failed: ${err.message}`);
      console.error('Studiora extraction error:', err);

      // Show partial results if any
      if (err.partialResults) {
        setExtractedData(err.partialResults);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      setInputText(content);
      await extractWithStudiora(content);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleExtract = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to extract');
      return;
    }
    await extractWithStudiora(inputText);
  };

  const handleEdit = (index) => {
    setEditIndex(index);
    setEditedItem({ ...extractedData.assignments[index] });
  };

  const handleSave = () => {
    if (!editedItem) return;

    const newAssignments = [...extractedData.assignments];
    newAssignments[editIndex] = editedItem;
    setExtractedData({
      ...extractedData,
      assignments: newAssignments,
      metadata: {
        ...extractedData.metadata,
        totalItems: newAssignments.length
      }
    });
    setEditIndex(null);
    setEditedItem(null);
  };

  const handleDelete = (index) => {
    const newAssignments = extractedData.assignments.filter((_, i) => i !== index);
    setExtractedData({
      ...extractedData,
      assignments: newAssignments,
      metadata: {
        ...extractedData.metadata,
        totalItems: newAssignments.length
      }
    });
  };

  const handleImportToStudiora = () => {
    if (onExtractComplete && extractedData?.assignments) {
      onExtractComplete(extractedData.assignments);
    }
    onClose();
  };

  const downloadJSON = () => {
    const dataStr = JSON.stringify(extractedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `studiora_extraction_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2))
      .then(() => {
        // Could add a toast notification here
      })
      .catch((err) => {
        console.error('Failed to copy:', err);
      });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 sm:p-6 border-b dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold dark:text-white">Studiora Course Extractor</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!extractedData ? (
          <div className="space-y-6">
            {/* Course Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Course:
              </label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              >
                {courses?.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.name}
                  </option>
                )) || <option value="">No courses available</option>}
              </select>
            </div>

            {/* Input Method Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setInputMethod('paste')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${inputMethod === 'paste'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <ClipboardPaste className="h-4 w-4" />
                Paste Text
              </button>
              <button
                onClick={() => setInputMethod('upload')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${inputMethod === 'upload'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
            </div>

            {/* Input Area */}
            {inputMethod === 'paste' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paste your course content:
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your syllabus, course schedule, or any course documentation..."
                  className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm resize-none"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Drop your document here or click to browse</p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".txt,.doc,.docx,.pdf"
                  />
                  <span className="mt-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 inline-block">
                    Select File
                  </span>
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Supported: .txt files</p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Extract Button */}
            {inputMethod === 'paste' && (
              <button
                onClick={handleExtract}
                disabled={!inputText.trim() || isExtracting || !selectedCourse}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isExtracting ? (
                  <>
                    <Brain className="h-5 w-5 animate-pulse" />
                    Studiora is processing...
                  </>
                ) : (
                  <>
                    <Brain className="h-5 w-5" />
                    Extract with Studiora
                  </>
                )}
              </button>
            )}

            {/* Processing indicator */}
            {isExtracting && inputMethod === 'upload' && (
              <div className="flex items-center justify-center gap-2 text-purple-600">
                <Brain className="h-6 w-6 animate-pulse" />
                <span className="font-medium">Studiora is analyzing your document...</span>
              </div>
            )}
          </div>
        ) : (
          /* Results Section */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold dark:text-white">Extraction Results</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found {extractedData.assignments.length} items • Confidence: {((extractedData.metadata?.confidence || 0) * 100).toFixed(0)}%
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyJSON}
                  className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Copy JSON
                </button>
                <button
                  onClick={downloadJSON}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  onClick={handleImportToStudiora}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Import to Studiora
                </button>
              </div>
            </div>

            {/* JSON Preview */}
            <details className="bg-gray-900 rounded-lg overflow-hidden">
              <summary className="px-4 py-2 bg-gray-800 text-gray-300 cursor-pointer hover:bg-gray-700 transition-colors">
                View JSON Output
              </summary>
              <div className="p-4 overflow-x-auto max-h-64">
                <pre className="text-green-400 text-sm font-mono">
                  <code>{JSON.stringify(extractedData, null, 2)}</code>
                </pre>
              </div>
            </details>

            {/* Items List */}
            <div className="space-y-2">
              {extractedData.assignments.map((item, index) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
                  {editIndex === index ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editedItem.text}
                          onChange={(e) => setEditedItem({ ...editedItem, text: e.target.value })}
                          className="border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                          placeholder="Description"
                        />
                        <select
                          value={editedItem.type}
                          onChange={(e) => setEditedItem({ ...editedItem, type: e.target.value })}
                          className="border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="assignment">assignment</option>
                          <option value="quiz">quiz</option>
                          <option value="exam">exam</option>
                          <option value="reading">reading</option>
                          <option value="video">video</option>
                          <option value="clinical">clinical</option>
                          <option value="simulation">simulation</option>
                          <option value="presentation">presentation</option>
                          <option value="discussion">discussion</option>
                          <option value="class">class</option>
                          <option value="powerpoint">powerpoint</option>
                          <option value="lecture">lecture</option>
                          <option value="lab">lab</option>
                          <option value="project">project</option>
                          <option value="other">other</option>
                        </select>
                        <input
                          type="date"
                          value={editedItem.date || ''}
                          onChange={(e) => setEditedItem({ ...editedItem, date: e.target.value || null })}
                          className="border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={editedItem.hours}
                            onChange={(e) => setEditedItem({ ...editedItem, hours: parseFloat(e.target.value) || 1.5 })}
                            className="flex-1 border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                            placeholder="Hours"
                            step="0.5"
                            min="0.5"
                          />
                          <input
                            type="text"
                            value={editedItem.category || ''}
                            onChange={(e) => setEditedItem({ ...editedItem, category: e.target.value || undefined })}
                            className="flex-1 border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
                            placeholder="Category"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-700 dark:text-green-400"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditIndex(null);
                            setEditedItem(null);
                          }}
                          className="text-gray-600 hover:text-gray-700 dark:text-gray-400"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${item.type === 'assignment' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                              item.type === 'quiz' || item.type === 'exam' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                item.type === 'clinical' || item.type === 'simulation' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                            {item.type}
                          </span>
                          <h4 className="font-medium dark:text-white">{item.text}</h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          {item.date && (
                            <span>Due: {new Date(item.date).toLocaleDateString()}</span>
                          )}
                          <span>{item.hours}h</span>
                          {item.category && (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                              {item.category}
                            </span>
                          )}
                          <span className="text-xs">
                            Confidence: {((item.confidence || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <button
                          onClick={() => handleEdit(index)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(index)}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Quick access card for dashboard
export function StudiorExtractorCard({ onOpen }) {
  return (
    <div className="bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Need to import a syllabus?
          </h3>
          <p className="mt-2 opacity-90">
            Studiora can automatically extract all assignments, readings, and course requirements from your documents
          </p>
        </div>
        <button
          onClick={onOpen}
          className="px-6 py-3 bg-white text-purple-600 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
        >
          Open Extractor
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default CourseExtractorModal;