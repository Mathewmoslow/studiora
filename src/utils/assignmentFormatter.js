// src/utils/assignmentFormatter.js
// Format assignments with action verbs and categories

export const formatAssignmentForDisplay = (assignment) => {
  const actionVerbs = {
    'reading': 'READ',
    'video': 'WATCH', 
    'quiz': 'QUIZ',
    'exam': 'TEST',
    'assignment': 'DO',
    'discussion': 'DISCUSS',
    'clinical': 'ATTEND',
    'simulation': 'PRACTICE',
    'prep': 'STUDY',
    'activity': 'COMPLETE',
    'remediation': 'REVIEW'
  };

  const priorities = {
    'exam': 'HIGH',
    'quiz': 'MEDIUM',
    'clinical': 'HIGH',
    'assignment': 'MEDIUM',
    'reading': 'LOW',
    'video': 'LOW'
  };

  const actionVerb = actionVerbs[assignment.type] || 'DO';
  const priority = priorities[assignment.type] || 'MEDIUM';
  
  // Clean up the assignment text
  let cleanText = assignment.text
    .replace(/^(assignment|quiz|exam|reading|video|discussion)[\s:]+/i, '')
    .replace(/\s*\(due[^)]*\)/i, '')
    .trim();

  // Add course context if missing
  const coursePrefix = assignment.course && assignment.course !== 'unknown' 
    ? assignment.course.toUpperCase() 
    : '';

  return {
    ...assignment,
    actionVerb,
    priority,
    cleanText,
    coursePrefix,
    displayTitle: `${actionVerb}: ${cleanText}`,
    fullTitle: coursePrefix ? `${coursePrefix} - ${actionVerb}: ${cleanText}` : `${actionVerb}: ${cleanText}`
  };
};

export const getActionIcon = (actionVerb) => {
  const icons = {
    'READ': '📖',
    'WATCH': '📺',
    'QUIZ': '❓',
    'TEST': '📝',
    'DO': '✏️',
    'DISCUSS': '💬',
    'ATTEND': '🏥',
    'PRACTICE': '🎯',
    'STUDY': '📚',
    'COMPLETE': '✅',
    'REVIEW': '🔄'
  };
  return icons[actionVerb] || '📋';
};

export const getPriorityColor = (priority) => {
  const colors = {
    'HIGH': 'bg-red-100 text-red-700 border-red-200',
    'MEDIUM': 'bg-yellow-100 text-yellow-700 border-yellow-200', 
    'LOW': 'bg-green-100 text-green-700 border-green-200'
  };
  return colors[priority] || colors['MEDIUM'];
};