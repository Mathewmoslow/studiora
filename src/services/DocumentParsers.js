// src/services/DocumentParsers.js
// Specialized parsers for different document types

// Base Canvas Parser
export class BaseCanvasParser {
  parseDate(dateStr) {
    if (!dateStr) return null;
    
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
            // Fixed: Use local timezone instead of UTC
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        }
      }
      
      // Try parsing as-is with year
      const dateWithYear = dateStr.includes('202') ? dateStr : dateStr + ', 2025';
      const date = new Date(dateWithYear);
      if (!isNaN(date.getTime())) {
        // Fixed: Use local timezone instead of UTC
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch (e) {
      console.warn('Failed to parse Canvas date:', dateStr);
    }
    
    return null;
  }
}

// Canvas Modules Page Parser
export class CanvasModulesParser extends BaseCanvasParser {
  parse(text, course) {
    const modules = [];
    const assignments = [];
    
    // Split by module headers
    const moduleRegex = /^(Module\s+\d+[:\s-]*[^\n]+)/gm;
    const moduleSections = text.split(moduleRegex).slice(1);
    
    for (let i = 0; i < moduleSections.length; i += 2) {
      const moduleName = moduleSections[i].trim();
      const moduleContent = moduleSections[i + 1] || '';
      
      const module = {
        name: moduleName,
        assignments: []
      };
      
      // Parse assignments within module
      const assignmentPatterns = [
        /^([^\n]+?)\s*(\d+)\s*pts?\s*(?:Due\s+)?(\w+\s+\d{1,2}(?:\s+at\s+\d{1,2}:\d{2}\s*(?:am|pm))?)/gm,
        /^([^\n]+?)\s*Due:\s*(\w+\s+\d{1,2}(?:\s+at\s+\d{1,2}:\d{2}\s*(?:am|pm))?)\s*(\d+)\s*pts?/gm,
        /^External Tool\s*\n([^\n]+)\s*\n[^\n]*\n(\d+)\s*pts/gm
      ];
      
      for (const pattern of assignmentPatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(moduleContent)) !== null) {
          const assignment = {
            id: `module_${Date.now()}_${assignments.length}`,
            text: match[1].trim(),
            date: this.parseDate(match[3] || match[2]),
            points: parseInt(match[2] || match[3] || 0),
            type: this.determineType(match[1]),
            hours: this.estimateHours(match[1], parseInt(match[2] || match[3] || 0)),
            course: course,
            module: moduleName,
            source: 'canvas-modules',
            confidence: 0.85
          };
          
          assignments.push(assignment);
          module.assignments.push(assignment.id);
        }
      }
      
      modules.push(module);
    }
    
    return { assignments, modules };
  }
  
  determineType(text) {
    const types = {
      'dropbox': /dropbox/i,
      'quiz': /quiz/i,
      'exam': /exam|test/i,
      'assignment': /assignment/i,
      'discussion': /discussion/i,
      'external': /external tool/i
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type;
    }
    
    return 'assignment';
  }
  
  estimateHours(text, points) {
    const pointsNum = points || 0;
    let hours = pointsNum > 50 ? 3 : pointsNum > 20 ? 2 : 1;
    
    // Add time for readings
    const chapterMatch = text.match(/chapters?\s*(\d+)(?:\s*-\s*(\d+))?/i);
    if (chapterMatch) {
      const start = parseInt(chapterMatch[1]);
      const end = chapterMatch[2] ? parseInt(chapterMatch[2]) : start;
      hours = Math.max(hours, (end - start + 1) * 0.75);
    }
    
    return hours;
  }
}

// Canvas Assignments Page Parser
export class CanvasAssignmentsParser extends BaseCanvasParser {
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
        // Fixed: Use local timezone instead of UTC
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
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
    
    if (/\b(final|midterm|project)\b/i.test(text)) {
      return baseHours * 2;
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
    const courseInfoRegex = /(?:course|class)[:.\s]*([A-Z]{2,4}\s*\d{3,4}[A-Z]?)/gi;
    let infoMatch;
    while ((infoMatch = courseInfoRegex.exec(text)) !== null) {
      courseInfo.courseCode = infoMatch[1].trim();
    }
    
    // Extract grading breakdown
    const gradingRegex = /(\w+(?:\s+\w+)?)\s*[:=]\s*(\d+)%/gi;
    const grading = {};
    let gradingMatch;
    while ((gradingMatch = gradingRegex.exec(text)) !== null) {
      grading[gradingMatch[1].trim()] = parseInt(gradingMatch[2]);
    }
    
    // Extract module/week structure
    const moduleRegex = /(Week|Module|Unit)\s*(\d+)[:\s-]*([^\n]+)?/gi;
    let moduleMatch;
    while ((moduleMatch = moduleRegex.exec(text)) !== null) {
      const moduleInfo = {
        type: moduleMatch[1],
        number: parseInt(moduleMatch[2]),
        title: moduleMatch[3] ? moduleMatch[3].trim() : `${moduleMatch[1]} ${moduleMatch[2]}`,
        content: []
      };
      
      // Find content under this module
      const startIndex = moduleMatch.index + moduleMatch[0].length;
      const nextModuleMatch = moduleRegex.exec(text);
      const endIndex = nextModuleMatch ? nextModuleMatch.index : text.length;
      moduleRegex.lastIndex = moduleMatch.index + moduleMatch[0].length;
      
      const moduleContent = text.substring(startIndex, endIndex);
      
      // Parse assignments in module content
      const assignmentRegex = /(?:due|submit|complete|prepare)\s*:?\s*([^\n]+)/gi;
      let assignmentMatch;
      while ((assignmentMatch = assignmentRegex.exec(moduleContent)) !== null) {
        const assignmentText = assignmentMatch[1].trim();
        if (assignmentText.length > 5) {
          const assignment = {
            id: `syllabus_${Date.now()}_${assignments.length}`,
            text: assignmentText,
            date: this.extractDate(assignmentText) || this.estimateModuleDate(moduleInfo.number),
            type: this.determineType(assignmentText),
            hours: this.estimateHours(assignmentText),
            course: course,
            module: moduleInfo.title,
            source: 'syllabus',
            confidence: 0.75
          };
          assignments.push(assignment);
          moduleInfo.content.push(assignment.id);
        }
      }
      
      modules.push(moduleInfo);
    }
    
    return { 
      assignments, 
      modules,
      courseInfo: { ...courseInfo, grading }
    };
  }
  
  extractDate(text) {
    const dateRegex = /(\w+\s+\d{1,2}(?:,?\s+\d{4})?)/;
    const match = text.match(dateRegex);
    if (match) {
      return this.parseDate(match[1]);
    }
    return null;
  }
  
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      let processedDate = dateStr;
      if (!dateStr.match(/\d{4}/)) {
        processedDate = dateStr + ', 2025';
      }
      
      const date = new Date(processedDate);
      if (!isNaN(date.getTime())) {
        // Fixed: Use local timezone instead of UTC
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch (e) {
      console.warn('Failed to parse syllabus date:', dateStr);
    }
    
    return null;
  }
  
  estimateModuleDate(moduleNumber) {
    // Estimate date based on module/week number
    const semesterStart = new Date('2025-05-05');
    const estimatedDate = new Date(semesterStart);
    estimatedDate.setDate(semesterStart.getDate() + (moduleNumber - 1) * 7);
    
    // Fixed: Use local timezone instead of UTC
    const yyyy = estimatedDate.getFullYear();
    const mm = String(estimatedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(estimatedDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  
  determineType(text) {
    const types = {
      'reading': /\b(read|chapter|textbook)\b/i,
      'quiz': /\bquiz\b/i,
      'exam': /\b(exam|test|midterm|final)\b/i,
      'paper': /\b(paper|essay|report)\b/i,
      'project': /\bproject\b/i,
      'discussion': /\b(discussion|forum|post)\b/i,
      'assignment': /\b(assignment|homework|exercise)\b/i
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type;
    }
    
    return 'assignment';
  }
  
  estimateHours(text) {
    let hours = 1.5;
    
    if (/\b(exam|test|midterm|final)\b/i.test(text)) {
      hours = 4;
    } else if (/\b(paper|essay|report)\b/i.test(text)) {
      hours = 3;
    } else if (/\b(chapter|reading)\b/i.test(text)) {
      const chapterMatch = text.match(/chapters?\s*(\d+)(?:\s*-\s*(\d+))?/i);
      if (chapterMatch) {
        const start = parseInt(chapterMatch[1]);
        const end = chapterMatch[2] ? parseInt(chapterMatch[2]) : start;
        hours = (end - start + 1) * 0.75;
      }
    }
    
    return Math.max(0.5, Math.min(8, hours));
  }
}

// Schedule Parser (for course calendars)
export class ScheduleParser {
  constructor() {
    this.dateContext = null;
    this.lines = [];
  }
  
  parse(text, course) {
    const assignments = [];
    this.lines = text.split('\n');
    this.dateContext = null;
    
    // Process each line
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i].trim();
      if (!line) continue;
      
      // Check if line contains a date
      const lineDate = this.extractDate(line, i);
      
      // Check if line contains an assignment
      if (this.isAssignment(line)) {
        const date = lineDate || this.getContextualDate(i);
        
        if (date) {
          const assignment = {
            id: `schedule_${Date.now()}_${assignments.length}`,
            text: this.cleanAssignmentText(line),
            date: date,
            type: this.determineType(line),
            hours: this.estimateHours(line),
            course: course,
            source: 'schedule',
            confidence: 0.8
          };
          
          assignments.push(assignment);
        }
      }
    }
    
    return { assignments, modules: [] };
  }
  
  isAssignment(line) {
    const assignmentPatterns = [
      /\b(due|submit|complete|quiz|exam|test|paper|project|assignment|homework)\b/i,
      /\b(read|chapter|pages?)\s+\d+/i,
      /\b\d+\s*(pts?|points)\b/i,
      /\bprepare\s+for\b/i,
      /\breview\s+for\b/i
    ];
    
    return assignmentPatterns.some(pattern => pattern.test(line));
  }
  
  cleanAssignmentText(text) {
    // Remove common prefixes and clean up
    return text
      .replace(/^[-•*]\s*/, '')
      .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*[:,-]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  extractDate(line, lineIndex) {
    // Date patterns to check
    const patterns = [
      // Week of X format
      /Week\s+of\s+(\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i,
      // Bullet or star with date
      /^[\*\-•]\s*(\w+\s+\d{1,2})(?:\s|,|:|$)/,
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
        // Fixed: Use local timezone instead of UTC
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
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
    let hours = 1.5;
    
    if (/\b(exam|test|midterm|final)\b/i.test(text)) {
      hours = 3;
    } else if (/\b(quiz)\b/i.test(text)) {
      hours = 1;
    } else if (/\b(paper|essay|report)\b/i.test(text)) {
      hours = 3;
    } else if (/\b(project)\b/i.test(text)) {
      hours = 4;
    } else if (/\b(chapter|reading)\b/i.test(text)) {
      const chapterMatch = text.match(/chapters?\s*(\d+)(?:\s*-\s*(\d+))?/i);
      if (chapterMatch) {
        const start = parseInt(chapterMatch[1]);
        const end = chapterMatch[2] ? parseInt(chapterMatch[2]) : start;
        hours = (end - start + 1) * 0.5;
      }
    }
    
    // Check for points as hint
    const pointsMatch = text.match(/(\d+)\s*(?:pts?|points)/i);
    if (pointsMatch) {
      const points = parseInt(pointsMatch[1]);
      if (points >= 50) hours = Math.max(hours, 3);
      else if (points >= 20) hours = Math.max(hours, 2);
    }
    
    return Math.max(0.5, Math.min(8, hours));
  }
}

// Export all parsers
export const DocumentParsers = {
  CanvasModulesParser,
  CanvasAssignmentsParser,
  SyllabusParser,
  ScheduleParser
};