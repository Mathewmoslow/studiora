// src/services/DocumentParsers.js
// ENHANCED VERSION: Complete with all parser classes

// Base Parser Class - shared functionality
class BaseCanvasParser {
  constructor() {
    // Generic patterns that work across all Canvas formats
    this.patterns = {
      // Course code patterns - matches any department code
      courseCode: /\b([A-Z]{2,4})\s*(\d{3,4}[A-Z]?)(?:\s*[:.\-]\s*(.+?))?(?=\n|Summer|Spring|Fall|Winter|$)/gi,
      
      // Term patterns
      term: /(Spring|Summer|Fall|Winter)\s*([A-Z]?\s*)?(\d{4})/gi,
      
      // Date patterns - comprehensive
      dates: {
        monthDay: /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:\s+(?:at|by)\s+(\d{1,2}):?(\d{2})?\s*(am|pm))?\b/gi,
        fullDate: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
        dayOfWeek: /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
        relativeDate: /\b(today|tomorrow|yesterday|next\s+\w+|this\s+\w+)\b/gi
      },
      
      // Time patterns
      time: /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|AM|PM)\b|\b(\d{1,2})\s*(am|pm|AM|PM)\b/gi,
      
      // Points patterns
      points: /(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?\s*(?:pts?|points?)/gi,
      
      // Assignment type indicators
      assignmentTypes: [
        'quiz', 'exam', 'test', 'assignment', 'homework', 'project',
        'paper', 'essay', 'discussion', 'lab', 'clinical', 'simulation',
        'presentation', 'reading', 'chapter', 'module', 'assessment',
        'activity', 'worksheet', 'case study', 'reflection', 'journal',
        'portfolio', 'practicum', 'midterm', 'final', 'hesi', 'ati'
      ]
    };
  }

  // Extract course information dynamically
  extractCourseInfo(text) {
    const matches = [...text.matchAll(this.patterns.courseCode)];
    const termMatch = text.match(this.patterns.term);
    
    if (matches.length > 0) {
      const [full, dept, number, name] = matches[0];
      return {
        code: `${dept}${number}`,
        department: dept,
        number: number,
        name: name ? name.trim() : 'Unknown Course',
        term: termMatch ? `${termMatch[1]} ${termMatch[3]}` : null
      };
    }
    
    return {
      code: 'UNKNOWN',
      department: null,
      number: null,
      name: 'Unknown Course',
      term: termMatch ? `${termMatch[1]} ${termMatch[3]}` : null
    };
  }

  // Parse dates flexibly
  parseDate(dateStr, referenceYear = null) {
    if (!dateStr) return null;
    
    const monthMap = {
      'jan': 0, 'january': 0, 'feb': 1, 'february': 1,
      'mar': 2, 'march': 2, 'apr': 3, 'april': 3,
      'may': 4, 'jun': 5, 'june': 5, 'jul': 6, 'july': 6,
      'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8,
      'oct': 9, 'october': 9, 'nov': 10, 'november': 10,
      'dec': 11, 'december': 11
    };
    
    // Try month day format
    const monthDayMatch = dateStr.match(this.patterns.dates.monthDay);
    if (monthDayMatch) {
      const monthName = monthDayMatch[1].toLowerCase();
      const month = monthMap[monthName] ?? monthMap[monthName.substring(0, 3)];
      const day = parseInt(monthDayMatch[2]);
      
      // Use reference year or current year
      const year = referenceYear || new Date().getFullYear();
      const date = new Date(year, month, day);
      
      // Adjust year if date seems to be in the past
      const now = new Date();
      if (date < now && !referenceYear) {
        date.setFullYear(year + 1);
      }
      
      return date.toISOString().split('T')[0];
    }
    
    // Try numeric format
    const numericMatch = dateStr.match(this.patterns.dates.fullDate);
    if (numericMatch) {
      const [, month, day, year] = numericMatch;
      const fullYear = year.length === 2 ? `20${year}` : year;
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return null;
  }

  // Parse time strings
  extractTime(timeStr) {
    if (!timeStr) return null;
    
    const timeMatch = timeStr.match(this.patterns.time);
    if (timeMatch) {
      // Handle both 12:30pm and 12pm formats
      const hour = timeMatch[1] || timeMatch[5];
      const minute = timeMatch[2] || '00';
      const ampm = (timeMatch[4] || timeMatch[6] || 'PM').toUpperCase();
      return `${hour}:${minute} ${ampm}`;
    }
    
    return null;
  }

  // Extract points from various formats
  extractPoints(text) {
    if (!text) return 0;
    
    const pointsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:pts?|points?)/i);
    if (pointsMatch) {
      return parseFloat(pointsMatch[1]);
    }
    
    // Check for score format (e.g., "35 / 50")
    const scoreMatch = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (scoreMatch) {
      return parseFloat(scoreMatch[2]); // Return total possible points
    }
    
    return 0;
  }

  // Determine assignment type from text
  determineType(text) {
    if (!text) return 'assignment';
    
    const lowerText = text.toLowerCase();
    
    // Check for specific types
    const typeChecks = {
      'exam': ['exam', 'test', 'midterm', 'final', 'assessment'],
      'quiz': ['quiz'],
      'clinical': ['clinical', 'practicum', 'rotation'],
      'lab': ['lab', 'laboratory'],
      'simulation': ['simulation', 'sim'],
      'discussion': ['discussion', 'forum', 'board'],
      'reading': ['read', 'chapter', 'textbook'],
      'paper': ['paper', 'essay', 'report'],
      'project': ['project'],
      'presentation': ['presentation', 'present']
    };
    
    for (const [type, keywords] of Object.entries(typeChecks)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return type;
      }
    }
    
    return 'assignment';
  }

  // Estimate hours based on type and other factors
  estimateHours(type, text, points) {
    const baseEstimates = {
      'exam': 4,
      'quiz': 1.5,
      'clinical': 8,
      'lab': 3,
      'simulation': 4,
      'discussion': 1,
      'reading': 2,
      'paper': 5,
      'project': 6,
      'presentation': 3,
      'assignment': 2
    };
    
    let hours = baseEstimates[type] || 2;
    
    // Adjust based on points
    if (points) {
      if (points >= 100) hours *= 2;
      else if (points >= 50) hours *= 1.5;
      else if (points <= 10 && points > 0) hours *= 0.75;
    }
    
    // Adjust based on keywords
    const lowerText = text.toLowerCase();
    if (lowerText.includes('final') || lowerText.includes('comprehensive')) {
      hours *= 1.5;
    }
    if (lowerText.includes('group') || lowerText.includes('team')) {
      hours *= 1.2;
    }
    
    return Math.round(hours * 10) / 10;
  }

  // Clean title
  cleanTitle(title) {
    if (!title) return '';
    
    return title
      .trim()
      .replace(/^(Quiz|Assignment|Test|Exam|Discussion|Lab|Clinical|Page|Attachment|External Tool)\s*:?\s*/i, '')
      .replace(/\s*-\s*Requires\s+Respondus.*/i, '')
      .replace(/\s*\(.*?\)\s*$/, '')
      .trim();
  }

  // Check if should be ignored
  isIgnored(title) {
    const ignoredPatterns = [
      /^(Page|Attachment|External Tool|Folder)$/i,
      /syllabus/i,
      /course schedule/i,
      /course calendar/i,
      /course outline/i,
      /welcome/i,
      /introduction/i,
      /getting started/i,
      /course information/i,
      /instructor/i,
      /office hours/i,
      /course resources/i,
      /^slides?$/i,
      /^powerpoint/i,
      /^ppt$/i,
      /^lecture notes?$/i,
      /^handout/i,
      /^template/i,
      /^rubric/i,
      /^guidelines?$/i
    ];
    
    return ignoredPatterns.some(pattern => pattern.test(title));
  }

  // Deduplicate assignments
  deduplicateAssignments(assignments) {
    const seen = new Map();
    
    return assignments.filter(assignment => {
      // Create a unique key based on title and due date
      const key = `${assignment.title.toLowerCase()}-${assignment.dueDate || 'no-date'}`;
      
      if (seen.has(key)) {
        // Keep the one with more information
        const existing = seen.get(key);
        if (assignment.points > existing.points || 
            (assignment.extractedFrom && assignment.extractedFrom.length > existing.extractedFrom.length)) {
          seen.set(key, assignment);
          return true;
        }
        return false;
      }
      
      seen.set(key, assignment);
      return true;
    });
  }
}

// Canvas Modules Parser
class CanvasModulesParser extends BaseCanvasParser {
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
      
      // Extract assignments within module - ENHANCED patterns
      const assignmentPatterns = [
        // Standard assignment format
        /(?:Assignment|Quiz|Discussion|Reading|Video|Lab)[:.\s]*(.+?)(?:\n|$)/gi,
        // Points format: "Assignment Name (10 pts) Due: Date"
        /(.+?)\s*\((\d+)\s*pts?\)\s*Due:\s*([^\n]+)/gi,
        // Due format: "Due Date: Assignment"
        /Due\s+([^\n]+?):\s*([^\n]+)/gi,
        // Action format: "Complete/Submit/Read X by Date"
        /(?:Complete|Submit|Read|Watch|Review)\s+(.+?)(?:\s+by\s+([^\n]+))?/gi,
        // Week-based assignments
        /Week\s+\d+\s*[:-]\s*(.+?)(?:\s*Due:\s*([^\n]+))?/gi,
        // Bullet points
        /^\s*[•\-*]\s*(.+?)(?:\s*Due:\s*([^\n]+))?$/gm,
        // Module assignments with "OB Clinical Orientation" format
        /^([^\n]+?)\s*"([^"]+)"\s*(?:Due:\s*([^\n]+))?$/gm
      ];
      
      for (const pattern of assignmentPatterns) {
        let assignMatch;
        pattern.lastIndex = 0;
        while ((assignMatch = pattern.exec(moduleContent)) !== null) {
          const text = assignMatch[1]?.trim() || assignMatch[2]?.trim();
          const points = assignMatch[2] && !isNaN(assignMatch[2]) ? assignMatch[2] : null;
          const dueDate = assignMatch[3] || assignMatch[2] || assignMatch[1];
          
          if (text && text.length > 3 && !assignments.some(a => a.text === text)) {
            assignments.push({
              id: `canvas_${Date.now()}_${assignments.length}`,
              text,
              points: points ? parseInt(points) : null,
              date: this.parseCanvasDate(dueDate),
              type: this.determineType(text),
              hours: this.estimateHours(this.determineType(text), text, points),
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
}

// Canvas Assignments Page Parser - ENHANCED for real Canvas format
class CanvasAssignmentsParser extends BaseCanvasParser {
  parse(text, course) {
    const assignments = [];
    
    // Enhanced patterns for Canvas assignments page
    const patterns = [
      // Canvas assignment list format with type prefix
      /^(Assignment|Quiz|Test|Exam|Project|Discussion|Lab|Clinical)\n([^\n]+)\n(?:Closed\s*)?\n?(?:Not available until[^\n]+\n)?(?:Due\s+)?(\w+\s+\d{1,2}\s+(?:at|by)\s+\d{1,2}(?::\d{2})?(?:am|pm)?)[^\n]*\n([\d.-]+)\/([\d.]+)\s*pts/gm,
      
      // Past/Upcoming assignments section items
      /^([^\n]+)\n(?:Quizzes and Assignments|[^\n]+)?\n(?:Due\s+)?(\w+\s+\d{1,2}\s+(?:at|by)\s+\d{1,2}(?::\d{2})?(?:am|pm)?)[^\n]*\n([\d.-]+)\/([\d.]+)\s*pts/gm,
      
      // Table format: "Assignment Name    Due Date    Points"
      /^([^\t\n]+?)\s{2,}(\w+\s+\d{1,2}(?:,?\s+\d{4})?)\s{2,}(\d+)\s*(?:pts?|points?)?$/gm,
      
      // List format with Due: prefix
      /^(.+?)\s*Due:\s*(\w+\s+\d{1,2}(?:,?\s+\d{4})?)\s*\((\d+)\s*(?:pts?|points?)\)/gm,
      
      // Score format for completed assignments
      /^([^\n]+)\n[^\n]+\n[^\n]+\n(?:Click to test a different score)?([\d.]+)\s*\/\s*([\d.]+)/gm
    ];
    
    const processedAssignments = new Set();
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        let assignmentText, dueDate, points, score;
        
        if (match.length === 6) {
          // Type-prefixed format
          const type = match[1];
          assignmentText = match[2].trim();
          dueDate = match[3].trim();
          score = match[4];
          points = match[5];
        } else if (match.length === 5) {
          // Standard format
          assignmentText = match[1].trim();
          dueDate = match[2].trim();
          score = match[3];
          points = match[4];
        } else if (match.length === 4) {
          // Other formats
          assignmentText = match[1].trim();
          dueDate = match[2].trim();
          points = match[3];
        }
        
        // Skip if already processed or too short
        if (!assignmentText || assignmentText.length < 3 || processedAssignments.has(assignmentText)) {
          continue;
        }
        
        processedAssignments.add(assignmentText);
        
        assignments.push({
          id: `assignment_${Date.now()}_${assignments.length}`,
          text: assignmentText,
          date: this.parseDate(dueDate),
          points: points ? parseFloat(points) : null,
          score: score && score !== '-' ? parseFloat(score) : null,
          completed: score && score !== '-',
          type: this.determineType(assignmentText),
          hours: this.estimateHours(this.determineType(assignmentText), assignmentText, points),
          course: course || this.inferCourse(assignmentText),
          source: 'canvas-assignments',
          confidence: 0.85,
          extractedFrom: match[0]
        });
      }
    }
    
    // Also check for dropbox assignments without points
    const dropboxPattern = /^([^\n]+(?:Dropbox|dropbox))\n(?!.*\d+\s*pts)/gm;
    let dropboxMatch;
    while ((dropboxMatch = dropboxPattern.exec(text)) !== null) {
      const assignmentText = dropboxMatch[1].trim();
      if (!processedAssignments.has(assignmentText)) {
        assignments.push({
          id: `dropbox_${Date.now()}_${assignments.length}`,
          text: assignmentText,
          type: 'assignment',
          points: 0,
          course: course || this.inferCourse(assignmentText),
          source: 'canvas-dropbox',
          confidence: 0.8,
          extractedFrom: dropboxMatch[0]
        });
      }
    }
    
    return { assignments, modules: [] };
  }
  
  inferCourse(text) {
    // Course code patterns
    const courseMatch = text.match(/\b(NURS|NUR|NSG)\s*(\d{3,4})\b/i);
    if (courseMatch) {
      const courseNum = parseInt(courseMatch[2]);
      if (courseNum === 330) return 'obgyn';
      if (courseNum === 310) return 'adulthealth';
      if (courseNum === 240) return 'mentalhealth';
      if (courseNum === 315) return 'geronto';
    }
    
    // Keywords
    if (/\b(childbearing|maternal|ob|pregnancy|postpartum|newborn)\b/i.test(text)) return 'obgyn';
    if (/\b(adult|cardiac|respiratory|renal)\b/i.test(text)) return 'adulthealth';
    if (/\b(mental|psych|psychiatric)\b/i.test(text)) return 'mentalhealth';
    
    return null;
  }
}

// Canvas Grades Page Parser
class CanvasGradesParser extends BaseCanvasParser {
  parse(text, course = null) {
    const assignments = [];
    const courseInfo = course || this.extractCourseInfo(text);
    
    // Patterns for grades page
    const patterns = {
      // Assignment row: Name, Category, Due, Submitted, Status, Score
      assignmentRow: /^(.+?)\n([^\n]+)?\n((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^\n]+)\s+by\s+([^\n]+)(?:\n([^\n]+)\n([^\n]+))?\n+(?:Click to test.*?)(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/gm,
      
      // Simpler pattern for assignments without all details
      simpleAssignment: /^(.+?)\n.*?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/gm,
      
      // Category totals
      categoryTotal: /^([^\n]+)\s+(\d+(?:\.\d+)?%)\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/gm
    };
    
    // Extract assignment rows
    const matches = [...text.matchAll(patterns.assignmentRow)];
    
    matches.forEach(match => {
      const [full, name, category, dueDate, dueTime, submitted, status, earned, possible] = match;
      
      const assignment = {
        id: `grades_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: this.cleanTitle(name),
        type: this.determineType(name),
        category: category || this.inferCategory(name),
        dueDate: this.parseDate(dueDate),
        dueTime: this.extractTime(dueTime) || dueTime,
        submittedDate: this.parseDate(submitted),
        status: status || 'Not Submitted',
        pointsEarned: parseFloat(earned),
        pointsPossible: parseFloat(possible),
        percentage: possible > 0 ? (earned / possible * 100).toFixed(2) : 0,
        course: courseInfo.code,
        courseName: courseInfo.name,
        source: 'canvas-grades'
      };
      
      assignments.push(assignment);
    });
    
    return {
      assignments,
      course: courseInfo,
      metadata: {
        documentType: 'canvas-grades',
        totalAssignments: assignments.length,
        categories: this.extractCategories(assignments)
      }
    };
  }

  inferCategory(name) {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('quiz')) return 'Quizzes and Assignments';
    if (lowerName.includes('exam')) return 'Module Exams';
    if (lowerName.includes('final')) return 'Final Exam';
    if (lowerName.includes('clinical')) return 'Clinical';
    if (lowerName.includes('lab')) return 'Lab';
    if (lowerName.includes('discussion')) return 'Discussions';
    if (lowerName.includes('hesi')) return 'Standardized Exams';
    
    return 'Assignments';
  }

  extractCategories(assignments) {
    const categories = {};
    
    assignments.forEach(assignment => {
      if (!categories[assignment.category]) {
        categories[assignment.category] = {
          count: 0,
          pointsEarned: 0,
          pointsPossible: 0
        };
      }
      
      categories[assignment.category].count++;
      categories[assignment.category].pointsEarned += assignment.pointsEarned || 0;
      categories[assignment.category].pointsPossible += assignment.pointsPossible || 0;
    });
    
    return categories;
  }
}

// Canvas Quizzes Page Parser
class CanvasQuizzesParser extends BaseCanvasParser {
  parse(text, course = null) {
    const quizzes = [];
    const courseInfo = course || this.extractCourseInfo(text);
    
    // Clean text
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Extract quizzes section
    const quizSection = this.extractQuizSection(cleanedText);
    
    // Parse quiz blocks
    const quizBlocks = this.splitIntoQuizBlocks(quizSection);
    
    quizBlocks.forEach(block => {
      const quiz = this.parseQuizBlock(block, courseInfo);
      if (quiz) {
        quizzes.push(quiz);
      }
    });
    
    return {
      assignments: quizzes, // Return as assignments for compatibility
      quizzes: quizzes,
      course: courseInfo,
      metadata: {
        documentType: 'canvas-quizzes',
        totalQuizzes: quizzes.length,
        quizCategories: this.categorizeQuizzes(quizzes)
      }
    };
  }
  
  extractQuizSection(text) {
    // Remove header/navigation content
    const startPattern = /^(Assignment\s+)?Quizzes?\s*$/m;
    const startMatch = text.match(startPattern);
    
    if (startMatch) {
      return text.substring(startMatch.index + startMatch[0].length);
    }
    
    return text;
  }
  
  splitIntoQuizBlocks(text) {
    const blocks = [];
    const lines = text.split('\n');
    let currentBlock = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this starts a new quiz block
      if (line === 'Quiz' && i + 1 < lines.length) {
        // Save previous block if exists
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
        }
        currentBlock = [line];
      } else if (currentBlock.length > 0) {
        currentBlock.push(lines[i]);
        
        // Check if we've reached the end of a quiz block (found points)
        if (line.match(/\d+\s*pts?/i) || line.match(/\d+\s*Questions?/i)) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
      }
    }
    
    // Don't forget the last block
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
    }
    
    return blocks;
  }
  
  parseQuizBlock(block, courseInfo) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return null;
    
    // First line should be "Quiz"
    if (lines[0] !== 'Quiz') return null;
    
    // Second line is the title
    let title = lines[1];
    
    // Parse remaining information
    let status = 'open';
    let availableDate = null;
    let availableTime = null;
    let dueDate = null;
    let dueTime = null;
    let points = 0;
    let questions = 0;
    let isLockdownBrowser = false;
    
    // Check for Respondus LockDown Browser
    if (title.includes('Requires Respondus LockDown Browser')) {
      isLockdownBrowser = true;
      title = title.replace(/\s*-?\s*Requires Respondus LockDown Browser/gi, '').trim();
    }
    
    // Parse remaining lines
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for closed status
      if (line === 'Closed') {
        status = 'closed';
        continue;
      }
      
      // Check for availability restriction
      if (line.startsWith('Not available until')) {
        status = 'locked';
        const availMatch = line.match(/Not available until\s+(.+?)\s+at\s+(.+?)(?:\s|$)/);
        if (availMatch) {
          availableDate = this.parseDate(availMatch[1]);
          availableTime = this.extractTime(availMatch[2]);
        }
      }
      
      // Check for due date
      if (line.startsWith('Due')) {
        const dueMatch = line.match(/Due\s+(.+?)\s+at\s+(.+?)(?:\s|$)/);
        if (dueMatch) {
          dueDate = this.parseDate(dueMatch[1]);
          dueTime = this.extractTime(dueMatch[2]);
        }
      }
      
      // Check for points
      const pointsMatch = line.match(/(\d+)\s*pts?/i);
      if (pointsMatch) {
        points = parseInt(pointsMatch[1]);
      }
      
      // Check for number of questions
      const questionsMatch = line.match(/(\d+)\s*Questions?/i);
      if (questionsMatch) {
        questions = parseInt(questionsMatch[1]);
      }
    }
    
    if (!title || this.isIgnored(title)) return null;
    
    return {
      id: `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: this.cleanTitle(title),
      type: 'quiz',
      status: status,
      availableDate: availableDate,
      availableTime: availableTime,
      dueDate: dueDate,
      dueTime: dueTime || '11:59 PM',
      points: points,
      questions: questions,
      requiresLockdownBrowser: isLockdownBrowser,
      course: courseInfo.code,
      courseName: courseInfo.name,
      estimatedHours: this.estimateQuizTime(questions, points),
      source: 'canvas-quizzes'
    };
  }
  
  estimateQuizTime(questions, points) {
    // Base estimate on number of questions
    let hours = 0.5; // Base time
    
    if (questions > 0) {
      // Assume 2-3 minutes per question
      hours = (questions * 2.5) / 60;
    } else if (points > 0) {
      // Estimate based on points if no question count
      if (points >= 100) hours = 2;
      else if (points >= 50) hours = 1.5;
      else if (points >= 20) hours = 1;
      else hours = 0.5;
    }
    
    return Math.round(hours * 10) / 10;
  }
  
  categorizeQuizzes(quizzes) {
    const categories = {
      open: 0,
      closed: 0,
      locked: 0,
      total: quizzes.length
    };
    
    quizzes.forEach(quiz => {
      if (categories[quiz.status] !== undefined) {
        categories[quiz.status]++;
      }
    });
    
    return categories;
  }
}

// Syllabus Parser - ENHANCED for nursing syllabus format
class SyllabusParser extends BaseCanvasParser {
  parse(text, course) {
    const assignments = [];
    const modules = [];
    const courseInfo = {};
    
    // Extract course information
    const courseInfoPatterns = {
      courseCode: /(?:course|class)[:.\s]*([A-Z]{2,4}\s*\d{3,4}[A-Z]?)/gi,
      courseName: /Course Name:\s*([^\n]+)/gi,
      instructor: /(?:instructor|professor)[:.\s]*([^\n]+)/gi,
      credits: /(\d+)\s*(?:credit|hour|cr|hrs?)s?/gi,
      term: /Term\/Year:\s*([^\n]+)/gi
    };
    
    for (const [field, pattern] of Object.entries(courseInfoPatterns)) {
      const match = text.match(pattern);
      if (match) {
        courseInfo[field] = match[1].trim();
      }
    }
    
    // Extract grading breakdown - ENHANCED for nursing syllabus
    const gradingPatterns = [
      /(\w+(?:\s+\w+)?)\s*[:=]\s*(\d+)%/gi,
      /(?:Unit\s+)?Exams?\s*(?:\(\d+\))?[:\s]*(\d+)%/gi,
      /Course\s+HESI\s+Standardized\s+Exam[:\s]*(\d+)%/gi,
      /Quizzes\/Assignments[:\s]*(\d+)%/gi
    ];
    
    const gradingBreakdown = {};
    for (const pattern of gradingPatterns) {
      let gradingMatch;
      while ((gradingMatch = pattern.exec(text)) !== null) {
        const component = gradingMatch[1] || 'Component';
        const percentage = gradingMatch[2] || gradingMatch[1];
        gradingBreakdown[component.trim()] = parseInt(percentage);
      }
    }
    
    // Extract schedule/assignments - ENHANCED for nursing module format
    const schedulePatterns = [
      // Module format from syllabus
      /Module\s+(\d+)\s*[:-]?\s*([^\n]+)([\s\S]*?)(?=Module\s+\d+|Week\s+\d+|$)/gi,
      // Week-based format
      /Week\s+(\d+)\s*(?:\([^)]+\))?\s*:?\s*([^\n]+)([\s\S]*?)(?=Week\s+\d+|Module\s+\d+|$)/gi,
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
            course: course || courseInfo.courseCode
          });
        }
        
        // Extract assignments from content - ENHANCED patterns
        const assignmentPatterns = [
          // Standard assignment patterns
          /(?:Read|Complete|Submit|Due|Assignment|Quiz|Exam|Test|Paper|Project)[:.\s]*([^\n]+)/gi,
          // Due date patterns
          /([^\n]+?)(?:\s*[-–]\s*)?(?:due|deadline|submit\s+by)[:.\s]*([^\n]+)/gi,
          // Bullet points
          /^[-•*]\s*([^\n]+)/gm,
          // Date-based assignments
          /(\w+\s+\d{1,2}):\s*([^\n]+)/gi,
          // Module content patterns from syllabus
          /(?:Chapter|Ch\.?)\s*(\d+)[:\s]*([^\n]+)/gi,
          /Adaptive\s+Quiz/gi,
          /Module\s+\d+\s+Adaptive\s+Quiz/gi,
          /HESI\s+(?:Standardized\s+)?Exam/gi
        ];
        
        for (const assignPattern of assignmentPatterns) {
          let assignMatch;
          assignPattern.lastIndex = 0;
          while ((assignMatch = assignPattern.exec(content)) !== null) {
            const assignmentText = assignMatch[1]?.trim() || assignMatch[2]?.trim() || assignMatch[0].trim();
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
                hours: this.estimateHours(this.determineType(assignmentText), assignmentText, 0),
                course: course || courseInfo.courseCode,
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
      /by\s+(\w+\s+\d{1,2})/i,
      /(\w+\s+\d{1,2}\s+(?:at|by)\s+\d{1,2}(?::\d{2})?(?:am|pm)?)/i
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
    
    // If week-based, calculate approximate date (Sunday of that week)
    if (weekIdentifier && weekIdentifier.includes('Week')) {
      const weekNum = parseInt(weekIdentifier.match(/\d+/)[0]);
      const semesterStart = new Date('2025-05-05'); // May 5, 2025
      const targetDate = new Date(semesterStart);
      targetDate.setDate(targetDate.getDate() + (weekNum - 1) * 7); // Sunday of that week
      return targetDate.toISOString().split('T')[0];
    }
    
    return null;
  }
}

// Schedule/Course Outline Parser - ENHANCED for nursing schedule format
class ScheduleParser extends BaseCanvasParser {
  parse(text, course) {
    const assignments = [];
    const modules = [];
    
    // Store lines and initialize context
    this.lines = text.split('\n');
    this.dateContext = null;
    
    let currentWeek = null;
    let currentModule = null;
    
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
      
      // Track module context
      const moduleMatch = line.match(/Module\s+(\d+)\s*[:-]?\s*(.+)?/i);
      if (moduleMatch) {
        currentModule = parseInt(moduleMatch[1]);
        modules.push({
          number: currentModule,
          title: moduleMatch[2]?.trim() || `Module ${currentModule}`,
          course: course
        });
      }
      
      // Extract date and update context
      const lineDate = this.extractDateFromLine(line, i);
      
      // Look for assignments - ENHANCED detection
      if (this.isAssignmentLine(line)) {
        const assignment = this.parseAssignmentLine(line, currentWeek, currentModule, lineDate || this.getContextualDate(i), course);
        if (assignment && !assignments.some(a => a.text === assignment.text)) {
          assignments.push(assignment);
        }
      }
    }
    
    return { assignments, modules };
  }
  
  isAssignmentLine(line) {
    // Enhanced assignment detection for nursing content
    const indicators = [
      /\b(quiz|exam|test|assignment|project|paper|read|chapter|complete|submit|hesi|remediation|activity|case\s*stud|simulation|registration|attestation|ticket\s*to\s*enter|pre-work|database|dropbox|clinical|lab|reflection|discussion|adaptive\s*quiz)\b/i,
      /\b(prep|review|reflection)\b.*\b(assignment|quiz|exam|test)\b/i,
      /\(\d+\s*(pts?|points?)\)/i,
      /\bdue\b/i,
      /^\*+[^:]+:/,  // Lines starting with * followed by content and :
      /Chapter\s+\d+/i,
      /Module\s+\d+\s+Adaptive\s+Quiz/i,
      /HESI\s+(?:Standardized\s+)?Exam/i
    ];
    
    return indicators.some(pattern => pattern.test(line));
  }
  
  parseAssignmentLine(line, currentWeek, currentModule, contextDate, course) {
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
      .replace(/^Module\s+\d+:?\s*/i, '')
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
      hours: this.estimateHours(this.determineType(assignmentText), assignmentText, points),
      course: course,
      week: currentWeek,
      module: currentModule,
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
      /\((\w+\s+\d{1,2}|\d{1,2}\/\d{1,2})\)/,
      // Canvas date format
      /(\w+\s+\d{1,2}\s+(?:at|by)\s+\d{1,2}(?::\d{2})?(?:am|pm)?)/i
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
}

// NEW: Sherpath Parser for Evolve content
class SherpathParser extends BaseCanvasParser {
  parse(text, course) {
    const assignments = [];
    const modules = [];
    let currentModule = null;
    
    // Split by lines for better processing
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Track modules
      const moduleMatch = line.match(/Module\s+(\d+)(?:\s*[:-]\s*(.+))?/i);
      if (moduleMatch) {
        currentModule = {
          number: parseInt(moduleMatch[1]),
          title: moduleMatch[2]?.trim() || `Module ${moduleMatch[1]}`,
          course: course
        };
        modules.push(currentModule);
      }
      
      // Parse eBook Reading
      if (line.includes('eBook Reading')) {
        const timeMatch = lines[i].match(/est\.\s*(\d+\s*(?:hr|hour|min)[^\n]*)/);
        const titleMatch = lines[i + 1]?.match(/Chapter\s+\d+[^:]*:\s*(.+)/);
        const bookMatch = lines[i + 2]?.match(/Murray:/);
        
        if (titleMatch || bookMatch) {
          const title = titleMatch ? titleMatch[0] : lines[i + 1]?.trim() || 'eBook Reading';
          assignments.push({
            id: `sherpath_reading_${Date.now()}_${assignments.length}`,
            text: title,
            type: 'reading',
            hours: this.parseTimeEstimate(timeMatch?.[1]),
            course: course,
            module: currentModule?.number,
            source: 'sherpath',
            platform: 'evolve',
            confidence: 0.95,
            extractedFrom: `${line} ${lines[i + 1] || ''}`
          });
        }
      }
      
      // Parse Osmosis Video
      if (line.includes('Osmosis Video')) {
        const timeMatch = line.match(/est\.\s*(\d+\s*min)/);
        const titleLine = lines[i + 1]?.trim();
        const dueMatch = lines[i + 3]?.match(/Due\s+(.+?)(?:\s+EDT)?$/);
        
        if (titleLine) {
          assignments.push({
            id: `osmosis_video_${Date.now()}_${assignments.length}`,
            text: titleLine,
            type: 'video',
            hours: this.parseTimeEstimate(timeMatch?.[1]),
            date: dueMatch ? this.parseSherpathDate(dueMatch[1]) : null,
            course: course,
            module: currentModule?.number,
            source: 'sherpath',
            platform: 'osmosis',
            confidence: 0.95,
            extractedFrom: `${line} ${titleLine}`
          });
        }
      }
      
      // Parse Adaptive Quiz
      if (line.includes('Adaptive Quiz (EAQ)')) {
        const titleLine = lines[i + 1]?.trim();
        const questionsMatch = lines[i + 2]?.match(/(\d+)\s*questions?/);
        const topicsMatch = lines[i + 3]?.match(/Topic\(s\):\s*(.+)/);
        const dueMatch = lines[i + 4]?.match(/Due\s+(.+?)(?:\s+EDT)?$/);
        
        if (titleLine) {
          assignments.push({
            id: `adaptive_quiz_${Date.now()}_${assignments.length}`,
            text: titleLine,
            type: 'quiz',
            questions: questionsMatch ? parseInt(questionsMatch[1]) : null,
            topics: topicsMatch?.[1],
            date: dueMatch ? this.parseSherpathDate(dueMatch[1]) : null,
            course: course,
            module: currentModule?.number,
            source: 'sherpath',
            platform: 'eaq',
            confidence: 0.95,
            extractedFrom: `${line} ${titleLine}`
          });
        }
      }
      
      // Parse Simulation
      if (line.includes('Simulation')) {
        const timeMatch = line.match(/est\.\s*(\d+\s*min)/);
        const titleLine = lines[i + 1]?.trim();
        
        if (titleLine) {
          assignments.push({
            id: `simulation_${Date.now()}_${assignments.length}`,
            text: titleLine,
            type: 'simulation',
            hours: this.parseTimeEstimate(timeMatch?.[1]),
            course: course,
            module: currentModule?.number,
            source: 'sherpath',
            confidence: 0.9,
            extractedFrom: `${line} ${titleLine}`
          });
        }
      }
    }
    
    return { assignments, modules };
  }
  
  parseTimeEstimate(timeStr) {
    if (!timeStr) return null;
    
    let totalHours = 0;
    
    // Parse hours
    const hourMatch = timeStr.match(/(\d+)\s*(?:hr|hour)/i);
    if (hourMatch) {
      totalHours += parseInt(hourMatch[1]);
    }
    
    // Parse minutes
    const minMatch = timeStr.match(/(\d+)\s*min/i);
    if (minMatch) {
      totalHours += parseInt(minMatch[1]) / 60;
    }
    
    return totalHours > 0 ? Math.round(totalHours * 10) / 10 : null;
  }
  
  parseSherpathDate(dateStr) {
    if (!dateStr) return null;
    
    // Month map
    const months = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    
    // Try different Sherpath date formats
    const patterns = [
      // "May. 4, 2025 at 11:59pm"
      /(\w+)\.?\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})(am|pm)/i,
      // "May. 4 at 11:59pm" (year implied)
      /(\w+)\.?\s+(\d{1,2})\s+at\s+(\d{1,2}):(\d{2})(am|pm)/i,
      // Simple "May. 4, 2025"
      /(\w+)\.?\s+(\d{1,2}),?\s+(\d{4})/i
    ];
    
    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        const monthName = match[1].toLowerCase();
        const month = months[monthName.substring(0, 3)];
        const day = parseInt(match[2]);
        const year = match[3] ? parseInt(match[3]) : 2025;
        
        const date = new Date(year, month, day);
        return date.toISOString().split('T')[0];
      }
    }
    
    return null;
  }
}

// Export parser information for UI
class DocumentParsers {
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
    'canvas-grades': {
      name: 'Canvas Grades Page',
      description: 'Copy/paste from Canvas grades page',
      parser: CanvasGradesParser
    },
    'canvas-quizzes': {
      name: 'Canvas Quizzes Page',
      description: 'Copy/paste from Canvas quizzes page',
      parser: CanvasQuizzesParser
    },
    'sherpath': {
      name: 'Sherpath/Evolve Content',
      description: 'Sherpath course plan or Evolve content',
      parser: SherpathParser
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
  
  static createParser(type) {
    const parserInfo = this.getParserInfo(type);
    if (parserInfo && parserInfo.parser) {
      return new parserInfo.parser();
    }
    return null;
  }
  
  static detectDocumentType(text) {
    // Auto-detect document type based on content patterns
    const detectionPatterns = {
      'canvas-modules': /(?:Week|Module)\s+\d+:.*?\n(?:Quiz|Assignment|Page|External Tool)/i,
      'canvas-assignments': /(?:Upcoming Assignments|Past Assignments|Assignment Quizzes)/i,
      'canvas-grades': /Grades for.*?\nName\s+Due\s+Submitted\s+Status\s+Score/i,
      'canvas-quizzes': /^Assignment\s+Quizzes?\s*$.*?Quiz\s*\n/im,
      'sherpath': /(?:Sherpath|Evolve).*?(?:eBook Reading|Adaptive Quiz|Osmosis Video)/i,
      'syllabus': /(?:Course\s+(?:Syllabus|Description|Information)|Instructor:|Office\s+Hours:|Prerequisites?:)/i,
      'schedule': /(?:Course\s+Schedule|Weekly\s+Schedule|Class\s+Calendar)/i
    };
    
    for (const [type, pattern] of Object.entries(detectionPatterns)) {
      if (pattern.test(text)) {
        return type;
      }
    }
    
    // Default to mixed/generic if no specific type detected
    return 'mixed';
  }
}

// Export all parser classes and default export
export {
  CanvasModulesParser,
  CanvasGradesParser,
  CanvasAssignmentsParser,
  SherpathParser,
  CanvasQuizzesParser,
  SyllabusParser,
  ScheduleParser,
  DocumentParsers
};

export default DocumentParsers;