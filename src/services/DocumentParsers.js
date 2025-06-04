// src/services/DocumentParsers.js

// Canvas Modules Parser
export class CanvasModulesParser {
  parse(text, course) {
    const assignments = [];
    const modules = [];
    
    // Canvas module structure: "Module X: Title"
    const moduleRegex = /Module\s+(\d+)[:.]?\s*(.+?)(?=Module\s+\d+|$)/gis;
    
    let moduleMatch;
    while ((moduleMatch = moduleRegex.exec(text)) !== null) {
      const moduleNum = moduleMatch[1];
      const moduleTitle = moduleMatch[2].trim();
      const moduleContent = moduleMatch[0];
      
      modules.push({
        number: parseInt(moduleNum),
        title: moduleTitle,
        course: course
      });
      
      // Extract assignments within module
      const assignmentPatterns = [
        /(?:Assignment|Quiz|Discussion|Reading|Video|Lab)[:.\s]*(.+?)(?:\n|$)/gi,
        /(.+?)\s*\((\d+)\s*pts?\)\s*Due:\s*([^\n]+)/gi,
        /Due\s+([^\n]+?):\s*([^\n]+)/gi,
        /Complete\s+(.+?)(?:\s+by\s+([^\n]+))?/gi,
        /Read\s+(.+?)(?:\s+by\s+([^\n]+))?/gi
      ];
      
      for (const pattern of assignmentPatterns) {
        let assignMatch;
        pattern.lastIndex = 0;
        while ((assignMatch = pattern.exec(moduleContent)) !== null) {
          const text = assignMatch[1]?.trim() || assignMatch[2]?.trim();
          const points = assignMatch[2] || null;
          const dueDate = assignMatch[3] || assignMatch[2] || assignMatch[1];
          
          if (text && text.length > 3 && !assignments.some(a => a.text === text)) {
            assignments.push({
              id: `canvas_${Date.now()}_${assignments.length}`,
              text,
              points: points ? parseInt(points) : null,
              date: this.parseCanvasDate(dueDate),
              type: this.determineType(text),
              hours: this.estimateHours(text),
              course: course,
              moduleNumber: parseInt(moduleNum),
              moduleTitle: moduleTitle,
              source: 'canvas-modules',
              confidence: 0.9,
              extractedFrom: assignMatch[0]
            });
          }
        }
      }
    }
    
    return { assignments, modules };
  }
  
  parseCanvasDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    // Canvas formats: "Jan 15 at 11:59pm", "Monday, Jan 15", "May 15", etc.
    const patterns = [
      { regex: /(\w+)\s+(\d{1,2})\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm)/i, type: 'datetime' },
      { regex: /(\w+),?\s+(\w+)\s+(\d{1,2})/i, type: 'daymonthdate' },
      { regex: /(\w+)\s+(\d{1,2})/i, type: 'monthdate' },
      { regex: /(\d{1,2})\/(\d{1,2})/i, type: 'numeric' }
    ];
    
    try {
      for (const { regex, type } of patterns) {
        const match = dateStr.match(regex);
        if (match) {
          let processedDate;
          
          switch (type) {
            case 'datetime':
            case 'daymonthdate':
            case 'monthdate':
              processedDate = dateStr + ', 2025';
              break;
            case 'numeric':
              processedDate = match[0] + '/2025';
              break;
          }
          
          const date = new Date(processedDate);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      }
      
      // Try parsing as-is with year
      const dateWithYear = dateStr.includes('202') ? dateStr : dateStr + ', 2025';
      const date = new Date(dateWithYear);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Failed to parse Canvas date:', dateStr);
    }
    
    return null;
  }
  
  determineType(text) {
    const types = {
      'quiz': /\bquiz\b/i,
      'exam': /\b(exam|test|midterm|final)\b/i,
      'assignment': /\b(assignment|homework|project)\b/i,
      'discussion': /\b(discussion|forum|post|respond)\b/i,
      'reading': /\b(reading|chapter|textbook|read)\b/i,
      'video': /\b(video|watch|view)\b/i,
      'lab': /\b(lab|laboratory)\b/i,
      'clinical': /\b(clinical|simulation)\b/i
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type;
    }
    
    return 'assignment';
  }
  
  estimateHours(text) {
    const estimates = {
      'quiz': 1.5,
      'exam': 3,
      'assignment': 2,
      'discussion': 1,
      'reading': 2,
      'video': 0.5,
      'lab': 4,
      'clinical': 8
    };
    
    const type = this.determineType(text);
    let hours = estimates[type] || 1.5;
    
    // Adjust for chapters
    const chapterMatch = text.match(/chapter[s]?\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
    if (chapterMatch) {
      const start = parseInt(chapterMatch[1]);
      const end = chapterMatch[2] ? parseInt(chapterMatch[2]) : start;
      hours = Math.max(hours, (end - start + 1) * 0.75);
    }
    
    return hours;
  }
}

// Canvas Assignments Page Parser
export class CanvasAssignmentsParser {
  parse(text, course) {
    const assignments = [];
    
    // Canvas assignments page patterns
    const patterns = [
      // Table format: "Assignment Name    Due Date    Points"
      /^([^\t\n]+?)\s{2,}(\w+\s+\d{1,2}(?:,?\s+\d{4})?)\s{2,}(\d+)\s*(?:pts?|points?)?$/gm,
      // Tab-separated format
      /^([^\t]+)\t+([^\t]+)\t+(\d+)\s*(?:pts?|points?)?$/gm,
      // List format with Due: prefix
      /^(.+?)\s*Due:\s*(\w+\s+\d{1,2}(?:,?\s+\d{4})?)\s*\((\d+)\s*(?:pts?|points?)\)/gm,
      // Alternative format with pipes
      /^([^\|]+?)\s*\|\s*Due:\s*([^\|]+)\s*\|\s*(\d+)\s*points?/gm
    ];
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const assignmentText = match[1].trim();
        const dueDate = match[2].trim();
        const points = parseInt(match[3]);
        
        if (assignmentText.length > 3 && !assignments.some(a => a.text === assignmentText)) {
          assignments.push({
            id: `assignment_${Date.now()}_${assignments.length}`,
            text: assignmentText,
            date: this.parseDate(dueDate),
            points: points,
            type: this.determineType(assignmentText),
            hours: this.estimateHours(assignmentText, points),
            course: course,
            source: 'canvas-assignments',
            confidence: 0.85,
            extractedFrom: match[0]
          });
        }
      }
    }
    
    return { assignments, modules: [] };
  }
  
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Add year if not present
      let processedDate = dateStr;
      if (!dateStr.match(/\d{4}/)) {
        processedDate = dateStr + ', 2025';
      }
      
      const date = new Date(processedDate);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Failed to parse date:', dateStr);
    }
    
    return null;
  }
  
  determineType(text) {
    const types = {
      'quiz': /\bquiz\b/i,
      'exam': /\b(exam|test|midterm|final)\b/i,
      'project': /\b(project|presentation)\b/i,
      'paper': /\b(paper|essay|report)\b/i,
      'assignment': /\b(assignment|homework)\b/i,
      'discussion': /\b(discussion|forum)\b/i,
      'lab': /\b(lab|laboratory)\b/i
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type;
    }
    
    return 'assignment';
  }
  
  estimateHours(text, points) {
    const pointsNum = points || 0;
    const baseHours = pointsNum > 50 ? 3 : pointsNum > 20 ? 2 : 1;
    
    // Adjust based on type
    if (/\b(final|midterm|project)\b/i.test(text)) {
      return baseHours * 2;
    }
    
    if (/\b(paper|essay|report)\b/i.test(text)) {
      return Math.max(4, baseHours * 1.5);
    }
    
    return baseHours;
  }
}

// Syllabus Parser
export class SyllabusParser {
  parse(text, course) {
    const assignments = [];
    const modules = [];
    const courseInfo = {};
    
    // Extract course information
    const courseInfoPatterns = {
      courseCode: /(?:course|class)[:.\s]*([A-Z]{2,4}\s*\d{3,4}[A-Z]?)/gi,
      instructor: /(?:instructor|professor)[:.\s]*([^\n]+)/gi,
      credits: /(\d+)\s*(?:credit|hour|cr|hrs?)s?/gi
    };
    
    for (const [field, pattern] of Object.entries(courseInfoPatterns)) {
      const match = text.match(pattern);
      if (match) {
        courseInfo[field] = match[1].trim();
      }
    }
    
    // Extract grading breakdown
    const gradingRegex = /(\w+(?:\s+\w+)?)\s*[:=]\s*(\d+)%/gi;
    const gradingBreakdown = {};
    let gradingMatch;
    while ((gradingMatch = gradingRegex.exec(text)) !== null) {
      gradingBreakdown[gradingMatch[1].trim()] = parseInt(gradingMatch[2]);
    }
    
    // Extract schedule/assignments
    const schedulePatterns = [
      // Week-based format
      /Week\s+(\d+)\s*(?:\([^)]+\))?\s*:?\s*([^\n]+)([\s\S]*?)(?=Week\s+\d+|Module\s+\d+|$)/gi,
      // Module-based format
      /Module\s+(\d+)\s*:?\s*([^\n]+)([\s\S]*?)(?=Module\s+\d+|Week\s+\d+|$)/gi,
      // Date-based format
      /(\w+\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?)\s*:?\s*([^\n]+)([\s\S]*?)(?=\w+\s+\d{1,2}|Week\s+\d+|Module\s+\d+|$)/gi
    ];
    
    for (const pattern of schedulePatterns) {
      let scheduleMatch;
      pattern.lastIndex = 0;
      while ((scheduleMatch = pattern.exec(text)) !== null) {
        const identifier = scheduleMatch[1];
        const topic = scheduleMatch[2].trim();
        const content = scheduleMatch[3];
        
        // Create module entry
        if (identifier.match(/\d+/)) {
          modules.push({
            number: parseInt(identifier.match(/\d+/)[0]),
            title: topic,
            course: course
          });
        }
        
        // Extract assignments from content
        const assignmentPatterns = [
          /(?:Read|Complete|Submit|Due|Assignment|Quiz|Exam|Test|Paper|Project)[:.\s]*([^\n]+)/gi,
          /([^\n]+?)(?:\s*[-–]\s*)?(?:due|deadline|submit\s+by)[:.\s]*([^\n]+)/gi,
          /^[-•*]\s*([^\n]+)/gm,
          /(\w+\s+\d{1,2}):\s*([^\n]+)/gi
        ];
        
        for (const assignPattern of assignmentPatterns) {
          let assignMatch;
          assignPattern.lastIndex = 0;
          while ((assignMatch = assignPattern.exec(content)) !== null) {
            const assignmentText = assignMatch[1].trim();
            const dueDateText = assignMatch[2]?.trim();
            
            // Skip if too short or looks like a header
            if (assignmentText.length < 5 || 
                assignmentText.match(/^(Topics?|Objectives?|Goals?|Overview|Content|Materials?)/i)) {
              continue;
            }
            
            if (!assignments.some(a => a.text === assignmentText)) {
              assignments.push({
                id: `syllabus_${Date.now()}_${assignments.length}`,
                text: assignmentText,
                date: this.extractDate(dueDateText || assignmentText, identifier),
                type: this.determineType(assignmentText),
                hours: this.estimateHours(assignmentText),
                course: course,
                week: identifier.includes('Week') ? parseInt(identifier.match(/\d+/)[0]) : null,
                module: identifier.includes('Module') ? parseInt(identifier.match(/\d+/)[0]) : null,
                source: 'syllabus',
                confidence: 0.75,
                extractedFrom: assignMatch[0]
              });
            }
          }
        }
      }
    }
    
    return { 
      assignments, 
      modules, 
      courseInfo, 
      gradingBreakdown 
    };
  }
  
  extractDate(text, weekIdentifier) {
    // Look for explicit dates in the text
    const datePatterns = [
      /(\w+\s+\d{1,2})/,
      /(\d{1,2}\/\d{1,2})/,
      /due\s+(\w+)/i,
      /by\s+(\w+\s+\d{1,2})/i
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1] || match[0];
        const date = new Date(dateStr + ', 2025');
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    // If week-based, calculate approximate date (Friday of that week)
    if (weekIdentifier && weekIdentifier.includes('Week')) {
      const weekNum = parseInt(weekIdentifier.match(/\d+/)[0]);
      const semesterStart = new Date('2025-05-05'); // May 5, 2025
      const targetDate = new Date(semesterStart);
      targetDate.setDate(targetDate.getDate() + (weekNum - 1) * 7 + 4); // Friday
      return targetDate.toISOString().split('T')[0];
    }
    
    return null;
  }
  
  determineType(text) {
    const types = {
      'reading': /\b(read|chapter|textbook|pages)\b/i,
      'quiz': /\bquiz\b/i,
      'exam': /\b(exam|test|midterm|final)\b/i,
      'paper': /\b(paper|essay|report|write|writing)\b/i,
      'project': /\b(project|presentation)\b/i,
      'discussion': /\b(discussion|forum|post|respond)\b/i,
      'assignment': /\b(assignment|homework|problem|exercise)\b/i,
      'lab': /\b(lab|laboratory)\b/i,
      'clinical': /\b(clinical|simulation)\b/i
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type;
    }
    
    return 'assignment';
  }
  
  estimateHours(text) {
    // Base estimates by type
    const type = this.determineType(text);
    const baseEstimates = {
      'reading': 2,
      'quiz': 1.5,
      'exam': 3,
      'paper': 5,
      'project': 6,
      'discussion': 1,
      'assignment': 2,
      'lab': 3,
      'clinical': 8
    };
    
    let hours = baseEstimates[type] || 2;
    
    // Adjust for reading chapters
    if (type === 'reading') {
      const chapterMatch = text.match(/chapter[s]?\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
      if (chapterMatch) {
        const start = parseInt(chapterMatch[1]);
        const end = chapterMatch[2] ? parseInt(chapterMatch[2]) : start;
        hours = (end - start + 1) * 1.5;
      }
    }
    
    // Adjust for major assessments
    if (/\b(final|comprehensive|cumulative)\b/i.test(text)) {
      hours = Math.max(hours * 1.5, 4);
    }
    
    return hours;
  }
}

// Schedule/Course Outline Parser
export class ScheduleParser {
  parse(text, course) {
    const assignments = [];
    const modules = [];
    
    // Store lines and initialize context
    this.lines = text.split('\n');
    this.dateContext = null;
    
    let currentWeek = null;
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i].trim();
      if (line.length < 3) continue;
      
      // Track week context
      const weekMatch = line.match(/Week\s+(\d+)/i);
      if (weekMatch) {
        currentWeek = parseInt(weekMatch[1]);
        modules.push({
          number: currentWeek,
          title: `Week ${currentWeek}`,
          course: course
        });
      }
      
      // Extract date and update context
      const lineDate = this.extractDateFromLine(line, i);
      
      // Look for assignments
      if (this.isAssignmentLine(line)) {
        const assignment = this.parseAssignmentLine(line, currentWeek, lineDate || this.getContextualDate(i), course);
        if (assignment && !assignments.some(a => a.text === assignment.text)) {
          assignments.push(assignment);
        }
      }
    }
    
    return { assignments, modules };
  }
  
  isAssignmentLine(line) {
    // More comprehensive assignment detection
    const indicators = [
      /\b(quiz|exam|test|assignment|project|paper|read|chapter|complete|submit|hesi|remediation|activity|case\s*stud|simulation|registration|attestation)\b/i,
      /\b(prep|review|reflection)\b.*\b(assignment|quiz|exam|test)\b/i,
      /\(\d+\s*(pts?|points?)\)/i,
      /\bdue\b/i,
      /^\*+[^:]+:/  // Lines starting with * followed by content and :
    ];
    
    return indicators.some(pattern => pattern.test(line));
  }
  
  parseAssignmentLine(line, currentWeek, contextDate, course) {
    // Extract the actual assignment text
    let assignmentText = line
      .replace(/^\*+\s*/, '') // Remove leading asterisks
      .replace(/^[-•]\s*/, '') // Remove bullets
      .replace(/\*+$/, '') // Remove trailing asterisks
      .trim();
    
    // Extract date from the line itself first
    let date = this.extractDateFromLine(line, this.lines.indexOf(line)) || contextDate;
    
    // Clean up assignment text by removing date prefixes
    assignmentText = assignmentText
      .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*/i, '')
      .replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}:?\s*/i, '')
      .replace(/^\d{1,2}\/\d{1,2}:?\s*/, '')
      .replace(/^Week\s+\d+:?\s*/i, '')
      .trim();
    
    // Extract points if present
    const pointsMatch = assignmentText.match(/\((\d+)\s*(pts?|points?)\)/i);
    const points = pointsMatch ? parseInt(pointsMatch[1]) : null;
    
    return {
      id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: assignmentText,
      date: date,
      points: points,
      type: this.determineType(assignmentText),
      hours: this.estimateHours(assignmentText),
      course: course,
      week: currentWeek,
      source: 'schedule',
      confidence: 0.7,
      extractedFrom: line
    };
  }
  
  extractDateFromLine(line, lineIndex) {
    // Multiple date patterns to try
    const patterns = [
      // *August 1:** format
      /\*+\s*(\w+\s+\d{1,2})\s*(?:\*+|:)/,
      // *Thursday August 7 format
      /\*+\s*((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\w+\s+\d{1,2})/i,
      // Standard date formats
      /(?:^|\s)(\w+\s+\d{1,2})(?:\s|,|:|$)/,
      /(?:^|\s)(\d{1,2}\/\d{1,2})(?:\s|,|:|$)/,
      // Due: date format
      /Due:\s*(\w+\s+\d{1,2}|\d{1,2}\/\d{1,2})/i,
      // Parenthetical dates
      /\((\w+\s+\d{1,2}|\d{1,2}\/\d{1,2})\)/
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const dateStr = match[1].trim();
        const parsedDate = this.parseScheduleDate(dateStr);
        if (parsedDate) {
          // Look for empty lines to determine scope
          const hasEmptyBefore = lineIndex > 0 && this.lines[lineIndex - 1].trim() === '';
          const hasEmptyAfter = lineIndex < this.lines.length - 1 && this.lines[lineIndex + 1].trim() === '';
          
          // Store with context direction
          this.dateContext = {
            date: parsedDate,
            lineIndex: lineIndex,
            appliesForward: hasEmptyBefore || !hasEmptyAfter,
            appliesBackward: hasEmptyAfter || !hasEmptyBefore
          };
          
          return parsedDate;
        }
      }
    }
    
    return null;
  }
  
  getContextualDate(lineIndex) {
    if (!this.dateContext) return null;
    
    const { date, lineIndex: contextLineIndex, appliesForward, appliesBackward } = this.dateContext;
    
    // Check if current line is within context scope
    if (lineIndex > contextLineIndex && appliesForward) {
      return date;
    }
    if (lineIndex < contextLineIndex && appliesBackward) {
      return date;
    }
    
    return null;
  }
  
  parseScheduleDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Remove day names if present
      const cleanDateStr = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, '');
      
      // Add year if not present
      let fullDateStr = cleanDateStr;
      if (!cleanDateStr.match(/\d{4}/)) {
        fullDateStr = cleanDateStr + ', 2025';
      }
      
      const date = new Date(fullDateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Failed to parse schedule date:', dateStr);
    }
    
    return null;
  }
  
  determineType(text) {
    const types = {
      'reading': /\b(read|chapter|textbook)\b/i,
      'quiz': /\bquiz\b/i,
      'exam': /\b(exam|test|midterm|final)\b/i,
      'assignment': /\b(assignment|homework)\b/i,
      'project': /\bproject\b/i,
      'paper': /\b(paper|essay|report)\b/i,
      'lab': /\b(lab|laboratory)\b/i,
      'clinical': /\b(clinical|simulation)\b/i
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type;
    }
    
    return 'assignment';
  }
  
  estimateHours(text) {
    const type = this.determineType(text);
    const estimates = {
      'reading': 2,
      'quiz': 1.5,
      'exam': 3,
      'assignment': 2,
      'project': 4,
      'paper': 5,
      'lab': 3,
      'clinical': 8
    };
    
    return estimates[type] || 2;
  }
}

// Export parser information for UI
export class DocumentParsers {
  static parsers = {
    'canvas-modules': {
      name: 'Canvas Modules Page',
      description: 'Copy/paste from Canvas modules page',
      parser: CanvasModulesParser
    },
    'canvas-assignments': {
      name: 'Canvas Assignments Page',
      description: 'Copy/paste from Canvas assignments list',
      parser: CanvasAssignmentsParser
    },
    'syllabus': {
      name: 'Course Syllabus',
      description: 'Complete course syllabus document',
      parser: SyllabusParser
    },
    'schedule': {
      name: 'Course Schedule/Outline',
      description: 'Weekly schedule or course outline',
      parser: ScheduleParser
    }
  };

  static getParserInfo(type) {
    return this.parsers[type] || null;
  }
  
  static getAllParsers() {
    return Object.entries(this.parsers).map(([id, info]) => ({
      id,
      ...info
    }));
  }
}