// src/services/RegexDocumentParser.js
// MINIMAL FIX: Only the regex error fixed, everything else unchanged

export class RegexDocumentParser {
  constructor() {
    // Comprehensive regex patterns for all nursing education formats
    this.patterns = {
      // Date patterns - handles multiple formats
      date: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\w+\s+\d{1,2},?\s+\d{4})|(\d{1,2}\s+\w+\s+\d{4})|(\w+\s+\d{1,2})|(\d{1,2}\/\d{1,2})|(\d{1,2}-\d{1,2})/gi,
      
      // Time patterns
      time: /(\d{1,2}:\d{2}\s*[AaPp][Mm])|(\d{1,2}[AaPp][Mm])|(\d{1,2}:\d{2})/gi,
      
      // Module/unit patterns
      module: /(?:module|unit|chapter|week|lesson)\s*(\d+):?\s*(.+?)(?=(?:module|unit|chapter|week|lesson)\s*\d+|\n\n|$)/gis,
      
      // Assignment patterns - comprehensive
      assignment: /(?:assignment|quiz|exam|test|project|paper|discussion|reading|chapter|video|lab|clinical|homework|worksheet|case\s*study|simulation|prep|preparation|review|study|complete|submit|turn\s*in|due)[\s:]*(.+?)(?=\n|$)/gi,
      
      // Course code patterns
      course: /(?:NURS|NUR|NSG|NURSING)\s*\d{3,4}[A-Z]?\s*-?\s*(.+?)(?=\n|$)/gi,
      
      // Credit patterns
      credits: /(\d+)\s*(?:credit|hour|cr|hrs?)s?/gi,
      
      // Due date indicators
      dueDate: /(?:due|deadline|submit\s*by|turn\s*in\s*by|complete\s*by|finish\s*by)[\s:]*(.*?)(?=\n|$)/gi,
      
      // Class meeting patterns
      classMeeting: /(?:class|lecture|lab|clinical|meeting)[\s:]*((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2}).*?)(?=\n|$)/gi,
      
      // Relative date patterns
      relativeDate: /(?:next\s+week|this\s+week|next\s+\w+day|tomorrow|today|end\s+of\s+week)/gi,
      
      // Nursing-specific terms
      nursingTerms: /(?:clinical|simulation|skills?\s*lab|hesi|nclex|case\s*study|care\s*plan|nursing\s*process|assessment|intervention|evaluation|med\s*calc|medication|pharmacology|pathophysiology)/gi,
      
      // Week patterns
      weekPattern: /week\s*(\d+)[\s:]*(.*?)(?=week\s*\d+|\n\n|$)/gis,
      
      // Syllabus-specific patterns
      syllabusSection: /(?:course\s*description|learning\s*objectives?|grading|assignments?|schedule|calendar|outline)[\s:]*(.*?)(?=(?:course\s*description|learning\s*objectives?|grading|assignments?|schedule|calendar|outline)|\n\n|$)/gis,
      
      // Learning objectives
      learningObjective: /(?:students?\s*will|upon\s*completion|objectives?|goals?)[\s:]*(.*?)(?=\n\n|$)/gis
    };
  }

  parse(text, template = 'auto') {
    const results = {
      assignments: [],
      modules: [],
      events: [],
      learningObjectives: {},
      classMeetings: [],
      errors: [],
      metadata: {
        originalLength: text.length,
        detectedFormat: template,
        parsingMethod: 'regex-complete'
      }
    };

    try {
      // Clean and normalize text
      text = this.cleanText(text);
      
      // Auto-detect format if needed
      if (template === 'auto') {
        template = this.detectFormat(text);
        results.metadata.detectedFormat = template;
      }
      
      // Parse based on detected/specified template
      switch (template) {
        case 'canvas':
          this.parseCanvasFormat(text, results);
          break;
        case 'syllabus':
          this.parseSyllabusFormat(text, results);
          break;
        case 'outline':
          this.parseCourseOutlineFormat(text, results);
          break;
        case 'json':
          this.parseJSONFormat(text, results);
          break;
        case 'weekly':
          this.parseWeeklyFormat(text, results);
          break;
        default:
          this.parseGenericFormat(text, results);
      }
      
      // Always run comprehensive post-processing
      this.postProcessResults(results, text);
      
    } catch (error) {
      results.errors.push(`Parsing error: ${error.message}`);
      console.error('RegexDocumentParser error:', error);
    }
    
    return results;
  }

  cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\t/g, '    ')           // Convert tabs to spaces
      .replace(/[^\S\n]+/g, ' ')        // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')       // Limit consecutive newlines
      .trim();
  }

  // FIXED: The only change - safer format detection
  detectFormat(text) {
    const lowerText = text.toLowerCase();
    
    // Use simple string includes instead of regex to avoid the regex error
    if (lowerText.includes('modules') || lowerText.includes('canvas') || lowerText.includes('assignments') || lowerText.includes('discussions') || lowerText.includes('quizzes')) {
      return 'canvas';
    }
    
    if (lowerText.includes('syllabus') || lowerText.includes('course description') || lowerText.includes('instructor') || lowerText.includes('office hours') || lowerText.includes('grading policy')) {
      return 'syllabus';
    }
    
    if (lowerText.includes('week 1') || lowerText.includes('week 2') || lowerText.includes('schedule') || lowerText.includes('calendar') || lowerText.includes('timeline')) {
      return 'outline';
    }
    
    if (text.trim().startsWith('{') || text.trim().startsWith('[') || lowerText.includes('"assignments":') || lowerText.includes('"modules":')) {
      return 'json';
    }
    
    if (lowerText.includes('week') || lowerText.includes('monday') || lowerText.includes('tuesday') || lowerText.includes('wednesday') || lowerText.includes('thursday') || lowerText.includes('friday')) {
      return 'weekly';
    }
    
    return 'generic';
  }

  parseCanvasFormat(text, results) {
    // Parse Canvas-style modules
    this.extractModulesFromText(text, results, 'canvas');
    
    // Extract assignments from module context and standalone
    this.extractAssignmentsFromText(text, results, 'canvas');
    
    // Extract discussion prompts and forums
    this.extractDiscussionsFromText(text, results);
    
    // Extract quiz/exam information
    this.extractQuizzesFromText(text, results);
  }

  parseSyllabusFormat(text, results) {
    // Parse syllabus sections
    this.extractSyllabusSections(text, results);
    
    // Extract course schedule
    this.extractCourseSchedule(text, results);
    
    // Parse grading/assignment information
    this.extractAssignmentsFromText(text, results, 'syllabus');
    
    // Extract learning objectives
    this.extractLearningObjectives(text, results);
    
    // Extract class meeting times
    this.extractClassMeetings(text, results);
  }

  parseCourseOutlineFormat(text, results) {
    // Parse week-by-week structure
    this.extractWeeklyStructure(text, results);
    
    // Extract assignments within weekly context
    this.extractAssignmentsFromText(text, results, 'outline');
    
    // Extract topics and objectives per week
    this.extractWeeklyObjectives(text, results);
  }

  parseJSONFormat(text, results) {
    try {
      const jsonData = JSON.parse(text);
      
      // Handle existing semester module format
      if (jsonData.modules || jsonData.semesterModules) {
        const modules = jsonData.modules || jsonData.semesterModules;
        this.parseModuleData(modules, results);
      }
      
      // Handle calendar events
      if (jsonData.events || jsonData.calendarEvents) {
        results.events = jsonData.events || jsonData.calendarEvents;
      }
      
      // Handle direct assignment arrays
      if (jsonData.assignments) {
        results.assignments = jsonData.assignments;
      }
      
    } catch (e) {
      results.errors.push(`JSON parsing error: ${e.message}`);
      // Fall back to text parsing
      this.parseGenericFormat(text, results);
    }
  }

  parseWeeklyFormat(text, results) {
    this.extractWeeklyStructure(text, results);
    this.extractAssignmentsFromText(text, results, 'weekly');
    this.extractWeeklyObjectives(text, results);
  }

  parseGenericFormat(text, results) {
    // Try all extraction methods for maximum coverage
    this.extractModulesFromText(text, results, 'generic');
    this.extractAssignmentsFromText(text, results, 'generic');
    this.extractWeeklyStructure(text, results);
    this.extractClassMeetings(text, results);
    this.extractLearningObjectives(text, results);
  }

  extractModulesFromText(text, results, context) {
    const moduleMatches = text.matchAll(this.patterns.module);
    
    for (const match of moduleMatches) {
      const moduleNum = match[1];
      const moduleTitle = match[2].trim();
      
      const module = {
        number: parseInt(moduleNum),
        title: moduleTitle,
        course: this.inferCourseFromText(moduleTitle + ' ' + match[0]),
        chapters: this.extractChaptersFromText(match[0]),
        keyTopics: this.extractTopicsFromText(match[0]),
        assignments: [],
        classMeeting: this.extractClassMeetingFromText(match[0]),
        source: `regex-${context}`
      };
      
      // Find assignments within this module
      const moduleText = match[0];
      const moduleAssignments = this.extractAssignmentsFromSection(moduleText, module.course);
      module.assignments = moduleAssignments;
      
      results.modules.push(module);
    }
  }

  extractAssignmentsFromText(text, results, context) {
    const assignmentMatches = text.matchAll(this.patterns.assignment);
    
    for (const match of assignmentMatches) {
      const assignment = this.parseFullAssignment(match[0], text, context);
      if (assignment && !this.isDuplicateAssignment(assignment, results.assignments)) {
        results.assignments.push(assignment);
      }
    }
    
    // Also check for due date patterns
    const dueDateMatches = text.matchAll(this.patterns.dueDate);
    for (const match of dueDateMatches) {
      const assignment = this.parseAssignmentFromDueDate(match[0], text, context);
      if (assignment && !this.isDuplicateAssignment(assignment, results.assignments)) {
        results.assignments.push(assignment);
      }
    }
  }

  extractAssignmentsFromSection(sectionText, course) {
    const assignments = [];
    const assignmentMatches = sectionText.matchAll(this.patterns.assignment);
    
    for (const match of assignmentMatches) {
      const assignment = this.parseFullAssignment(match[0], sectionText, 'module');
      if (assignment) {
        assignment.course = course || assignment.course;
        assignments.push(assignment);
      }
    }
    
    return assignments;
  }

  parseFullAssignment(text, fullContext, source) {
    const assignment = {
      id: this.generateId(),
      text: '',
      date: null,
      type: 'assignment',
      hours: 1,
      course: 'unknown',
      confidence: 0.8,
      source: `regex-${source}`,
      extractedFrom: text.trim()
    };

    // Clean and extract assignment text
    assignment.text = this.cleanAssignmentText(text);
    if (!assignment.text) return null;

    // Extract and parse date
    assignment.date = this.extractDateFromText(text, fullContext);

    // Determine assignment type
    assignment.type = this.determineAssignmentType(text);

    // Estimate hours based on type and content
    assignment.hours = this.estimateHours(text, assignment.type);

    // Infer course
    assignment.course = this.inferCourseFromText(text + ' ' + fullContext);

    // Calculate confidence based on extracted information
    assignment.confidence = this.calculateAssignmentConfidence(assignment, text);

    return assignment;
  }

  parseAssignmentFromDueDate(text, fullContext, source) {
    // Extract assignment info from due date patterns
    const parts = text.split(/due|deadline|submit/i);
    if (parts.length < 2) return null;

    const assignmentPart = parts[0].trim();
    const datePart = parts[1].trim();

    if (!assignmentPart) return null;

    const assignment = {
      id: this.generateId(),
      text: this.cleanAssignmentText(assignmentPart),
      date: this.parseDate(datePart),
      type: this.determineAssignmentType(assignmentPart),
      hours: this.estimateHours(assignmentPart, this.determineAssignmentType(assignmentPart)),
      course: this.inferCourseFromText(text + ' ' + fullContext),
      confidence: 0.7,
      source: `regex-due-date-${source}`,
      extractedFrom: text.trim()
    };

    return assignment.text ? assignment : null;
  }

  cleanAssignmentText(text) {
    return text
      .replace(this.patterns.assignment, '$1')
      .replace(/^[\s:-]+|[\s:-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractDateFromText(text, context) {
    // First try direct date patterns in the text
    const dateMatch = text.match(this.patterns.date);
    if (dateMatch) {
      return this.parseDate(dateMatch[0]);
    }

    // Try due date patterns
    const dueDateMatch = text.match(this.patterns.dueDate);
    if (dueDateMatch) {
      return this.parseDate(dueDateMatch[1]);
    }

    // Try relative date patterns
    const relativeDateMatch = text.match(this.patterns.relativeDate);
    if (relativeDateMatch) {
      return this.parseRelativeDate(relativeDateMatch[0]);
    }

    // Look in surrounding context
    const contextLines = context.split('\n');
    const textIndex = contextLines.findIndex(line => line.includes(text));
    
    if (textIndex !== -1) {
      // Check nearby lines for dates
      for (let i = Math.max(0, textIndex - 2); i <= Math.min(contextLines.length - 1, textIndex + 2); i++) {
        const lineDate = contextLines[i].match(this.patterns.date);
        if (lineDate) {
          return this.parseDate(lineDate[0]);
        }
      }
    }

    return null;
  }

  determineAssignmentType(text) {
    const lowerText = text.toLowerCase();
    
    // Specific type detection with priority order
    if (/\b(?:exam|test|midterm|final)\b/i.test(text)) return 'exam';
    if (/\b(?:quiz|assessment)\b/i.test(text)) return 'quiz';
    if (/\b(?:reading|chapter|textbook|ebook)\b/i.test(text)) return 'reading';
    if (/\b(?:video|watch|view|multimedia)\b/i.test(text)) return 'video';
    if (/\b(?:discussion|forum|post|reply)\b/i.test(text)) return 'discussion';
    if (/\b(?:lab|clinical|simulation|skills?)\b/i.test(text)) return 'clinical';
    if (/\b(?:project|paper|essay|report)\b/i.test(text)) return 'assignment';
    if (/\b(?:homework|hw|worksheet)\b/i.test(text)) return 'assignment';
    if (/\b(?:case\s*study|scenario)\b/i.test(text)) return 'case-study';
    if (/\b(?:prep|preparation|review|study)\b/i.test(text)) return 'preparation';
    
    return 'assignment';
  }

  estimateHours(text, type) {
    const baseHours = {
      'reading': 1.5,
      'video': 0.5,
      'quiz': 1,
      'exam': 2,
      'assignment': 2,
      'discussion': 1,
      'clinical': 8,
      'lab': 3,
      'project': 5,
      'case-study': 2,
      'preparation': 1,
      'simulation': 2
    };

    let hours = baseHours[type] || 1.5;

    // Adjust based on content indicators
    const lowerText = text.toLowerCase();
    
    if (/\b(?:chapter|chapters)\s*(\d+)-(\d+)/i.test(text)) {
      const match = text.match(/\b(?:chapter|chapters)\s*(\d+)-(\d+)/i);
      const chapterCount = parseInt(match[2]) - parseInt(match[1]) + 1;
      hours = Math.max(hours, chapterCount * 0.5);
    }
    
    if (/\b(?:pages?\s*(\d+)-(\d+))/i.test(text)) {
      const match = text.match(/\b(?:pages?\s*(\d+)-(\d+))/i);
      const pageCount = parseInt(match[2]) - parseInt(match[1]) + 1;
      hours = Math.max(hours, pageCount * 0.1);
    }

    if (/\b(?:comprehensive|final|major)\b/i.test(text)) {
      hours *= 1.5;
    }

    return Math.max(0.25, Math.min(8, hours));
  }

  parseDate(dateStr) {
    if (!dateStr) return null;

    const now = new Date();
    const currentYear = 2025; // Semester year

    try {
      // Handle "Month Day" format (e.g., "May 11")
      if (/^\w+\s+\d{1,2}$/.test(dateStr.trim())) {
        const date = new Date(`${dateStr}, ${currentYear}`);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }

      // Handle "Month Day, Year" format
      if (/^\w+\s+\d{1,2},\s*\d{4}$/.test(dateStr.trim())) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }

      // Handle MM/DD or MM/DD/YY or MM/DD/YYYY
      if (/^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?$/.test(dateStr.trim())) {
        const parts = dateStr.split(/[\/\-]/);
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const year = parts[2] ? (parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2])) : currentYear;
        
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }

      // Try parsing as-is
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }

      // Handle relative dates
      return this.parseRelativeDate(dateStr);

    } catch (e) {
      console.warn('Date parsing failed for:', dateStr, e);
      return this.parseRelativeDate(dateStr);
    }
  }

  parseRelativeDate(dateStr) {
    const now = new Date();
    const lowerDate = dateStr.toLowerCase();

    // Map weekdays
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let i = 0; i < weekdays.length; i++) {
      if (lowerDate.includes(weekdays[i])) {
        const targetDay = i;
        const currentDay = now.getDay();
        let daysUntil = targetDay - currentDay;
        
        if (daysUntil <= 0) {
          daysUntil += 7; // Next occurrence
        }
        
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + daysUntil);
        return targetDate.toISOString().split('T')[0];
      }
    }

    // Handle other relative terms
    if (lowerDate.includes('next week')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      return nextWeek.toISOString().split('T')[0];
    }

    if (lowerDate.includes('this week') || lowerDate.includes('end of week')) {
      const endOfWeek = new Date(now);
      const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
      endOfWeek.setDate(now.getDate() + daysUntilFriday);
      return endOfWeek.toISOString().split('T')[0];
    }

    if (lowerDate.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    if (lowerDate.includes('today')) {
      return now.toISOString().split('T')[0];
    }

    // Default fallback - one week from now
    const defaultDate = new Date(now);
    defaultDate.setDate(now.getDate() + 7);
    return defaultDate.toISOString().split('T')[0];
  }

  inferCourseFromText(text) {
    const courseMap = {
      'ob': 'obgyn',
      'obgyn': 'obgyn',
      'women': 'obgyn',
      'maternal': 'obgyn',
      'birthing': 'obgyn',
      'childbearing': 'obgyn',
      'pregnancy': 'obgyn',
      'labor': 'obgyn',
      'delivery': 'obgyn',
      'postpartum': 'obgyn',
      'newborn': 'obgyn',
      'fetal': 'obgyn',
      
      'adult': 'adulthealth',
      'cardiac': 'adulthealth',
      'cardiovascular': 'adulthealth',
      'respiratory': 'adulthealth',
      'pulmonary': 'adulthealth',
      'hematology': 'adulthealth',
      'endocrine': 'adulthealth',
      'diabetes': 'adulthealth',
      'renal': 'adulthealth',
      'musculoskeletal': 'adulthealth',
      'neurological': 'adulthealth',
      
      'nclex': 'nclex',
      'hesi': 'nclex',
      'standardized': 'nclex',
      'licensing': 'nclex',
      'board': 'nclex',
      'rn exam': 'nclex',
      
      'geronto': 'geronto',
      'gero': 'geronto',
      'elderly': 'geronto',
      'aging': 'geronto',
      'older adult': 'geronto',
      'senior': 'geronto',
      'dementia': 'geronto',
      'alzheimer': 'geronto'
    };

    const lowerText = text.toLowerCase();
    
    for (const [keyword, course] of Object.entries(courseMap)) {
      if (lowerText.includes(keyword)) {
        return course;
      }
    }

    // Check for NURS course codes
    const courseCodeMatch = text.match(/(?:NURS|NUR|NSG)\s*(\d{3,4})/i);
    if (courseCodeMatch) {
      const courseNum = parseInt(courseCodeMatch[1]);
      if (courseNum >= 330 && courseNum <= 339) return 'obgyn';
      if (courseNum >= 310 && courseNum <= 319) return 'adulthealth';
      if (courseNum >= 335 && courseNum <= 339) return 'nclex';
      if (courseNum >= 315 && courseNum <= 325) return 'geronto';
    }

    return 'unknown';
  }

  extractWeeklyStructure(text, results) {
    const weekMatches = text.matchAll(this.patterns.weekPattern);
    
    for (const match of weekMatches) {
      const weekNum = parseInt(match[1]);
      const weekContent = match[2].trim();
      
      const weekModule = {
        number: weekNum,
        title: `Week ${weekNum}`,
        course: this.inferCourseFromText(weekContent),
        chapters: this.extractChaptersFromText(weekContent),
        keyTopics: this.extractTopicsFromText(weekContent),
        assignments: this.extractAssignmentsFromSection(weekContent, null),
        classMeeting: this.extractClassMeetingFromText(weekContent),
        source: 'regex-weekly'
      };
      
      if (weekModule.assignments.length > 0 || weekModule.keyTopics || weekModule.chapters) {
        results.modules.push(weekModule);
      }
    }
  }

  extractSyllabusSections(text, results) {
    const sectionMatches = text.matchAll(this.patterns.syllabusSection);
    
    for (const match of sectionMatches) {
      const sectionContent = match[1].trim();
      
      // Process different section types
      if (match[0].toLowerCase().includes('assignment')) {
        this.extractAssignmentsFromSection(sectionContent, null)
          .forEach(assignment => {
            if (!this.isDuplicateAssignment(assignment, results.assignments)) {
              results.assignments.push(assignment);
            }
          });
      }
    }
  }

  extractCourseSchedule(text, results) {
    // Extract scheduled events, class times, etc.
    const classMeetings = this.extractClassMeetings(text, results);
    results.classMeetings = classMeetings;
  }

  extractClassMeetings(text, results) {
    const meetings = [];
    const meetingMatches = text.matchAll(this.patterns.classMeeting);
    
    for (const match of meetingMatches) {
      const meetingInfo = match[1].trim();
      meetings.push({
        type: 'class',
        schedule: meetingInfo,
        extracted: match[0].trim()
      });
    }
    
    return meetings;
  }

  extractLearningObjectives(text, results) {
    const objectiveMatches = text.matchAll(this.patterns.learningObjective);
    
    for (const match of objectiveMatches) {
      const objectives = match[1]
        .split(/[;,\n]/)
        .map(obj => obj.trim())
        .filter(obj => obj.length > 0);
      
      if (objectives.length > 0) {
        results.learningObjectives['general'] = objectives;
      }
    }
  }

  extractWeeklyObjectives(text, results) {
    // Extract objectives specific to each week
    const weekMatches = text.matchAll(this.patterns.weekPattern);
    
    for (const match of weekMatches) {
      const weekNum = match[1];
      const weekContent = match[2];
      
      const objectiveMatches = weekContent.matchAll(this.patterns.learningObjective);
      const objectives = [];
      
      for (const objMatch of objectiveMatches) {
        const weekObjectives = objMatch[1]
          .split(/[;,\n]/)
          .map(obj => obj.trim())
          .filter(obj => obj.length > 0);
        objectives.push(...weekObjectives);
      }
      
      if (objectives.length > 0) {
        results.learningObjectives[`week${weekNum}`] = objectives;
      }
    }
  }

  extractChaptersFromText(text) {
    const chapterPatterns = [
      /chapter\s*(\d+)(?:\s*-\s*(\d+))?/gi,
      /ch\.?\s*(\d+)(?:\s*-\s*(\d+))?/gi,
      /chapters?\s*(\d+(?:\s*,\s*\d+)*)/gi
    ];

    const chapters = [];
    
    for (const pattern of chapterPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[2]) {
          // Range: Chapter X-Y
          const start = parseInt(match[1]);
          const end = parseInt(match[2]);
          for (let i = start; i <= end; i++) {
            chapters.push(`Chapter ${i}`);
          }
        } else if (match[1].includes(',')) {
          // List: Chapters 1, 3, 5
          const chapterNums = match[1].split(',').map(n => n.trim());
          chapterNums.forEach(num => chapters.push(`Chapter ${num}`));
        } else {
          // Single: Chapter X
          chapters.push(`Chapter ${match[1]}`);
        }
      }
    }

    return chapters.length > 0 ? chapters.join(', ') : null;
  }

  extractTopicsFromText(text) {
    // Extract key topics mentioned in the text
    const nursingTermsFound = [];
    const matches = text.matchAll(this.patterns.nursingTerms);
    
    for (const match of matches) {
      nursingTermsFound.push(match[0]);
    }

    // Also look for capitalized phrases that might be topics
    const topicPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    const topicMatches = text.matchAll(topicPattern);
    
    for (const match of topicMatches) {
      const topic = match[1];
      if (topic.length > 3 && !nursingTermsFound.includes(topic.toLowerCase())) {
        nursingTermsFound.push(topic);
      }
    }

    return nursingTermsFound.length > 0 ? nursingTermsFound.slice(0, 5).join(', ') : null;
  }

  extractClassMeetingFromText(text) {
    const meetingMatch = text.match(this.patterns.classMeeting);
    return meetingMatch ? meetingMatch[1].trim() : null;
  }

  extractDiscussionsFromText(text, results) {
    const discussionPattern = /discussion[\s:]*(.*?)(?=\n|$)/gi;
    const matches = text.matchAll(discussionPattern);
    
    for (const match of matches) {
      const discussion = this.parseFullAssignment(match[0], text, 'discussion');
      if (discussion && !this.isDuplicateAssignment(discussion, results.assignments)) {
        discussion.type = 'discussion';
        results.assignments.push(discussion);
      }
    }
  }

  extractQuizzesFromText(text, results) {
    const quizPattern = /(?:quiz|test|exam)[\s:]*(.*?)(?=\n|$)/gi;
    const matches = text.matchAll(quizPattern);
    
    for (const match of matches) {
      const quiz = this.parseFullAssignment(match[0], text, 'quiz');
      if (quiz && !this.isDuplicateAssignment(quiz, results.assignments)) {
        results.assignments.push(quiz);
      }
    }
  }

  parseModuleData(modules, results) {
    if (typeof modules === 'object') {
      Object.entries(modules).forEach(([week, courses]) => {
        if (typeof courses === 'object') {
          Object.entries(courses).forEach(([courseName, moduleData]) => {
            const module = {
              number: parseInt(week),
              course: courseName,
              title: moduleData.title || `${courseName} Module ${week}`,
              chapters: moduleData.chapters || null,
              keyTopics: moduleData.keyTopics || null,
              assignments: moduleData.assignments || [],
              classMeeting: moduleData.classMeeting || null,
              source: 'regex-json'
            };
            
            results.modules.push(module);
            
            if (module.assignments) {
              results.assignments.push(...module.assignments);
            }
          });
        }
      });
    }
  }

  calculateAssignmentConfidence(assignment, originalText) {
    let confidence = 0.5;

    // Boost confidence based on what was successfully extracted
    if (assignment.date) confidence += 0.2;
    if (assignment.type !== 'assignment') confidence += 0.1;
    if (assignment.course !== 'unknown') confidence += 0.1;
    if (assignment.text.length > 5) confidence += 0.1;

    // Check for strong indicators
    if (/\b(?:due|deadline|submit)\b/i.test(originalText)) confidence += 0.1;
    if (/\b(?:quiz|exam|test|assignment|reading)\b/i.test(originalText)) confidence += 0.1;

    return Math.min(0.95, Math.max(0.1, confidence));
  }

  isDuplicateAssignment(newAssignment, existingAssignments) {
    return existingAssignments.some(existing => {
      const textSimilarity = this.calculateTextSimilarity(existing.text, newAssignment.text);
      const sameDateAndType = existing.date === newAssignment.date && 
                             existing.type === newAssignment.type;
      
      return textSimilarity > 0.8 || sameDateAndType;
    });
  }

  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  postProcessResults(results, originalText) {
    // Assign courses to modules without courses
    results.modules.forEach(module => {
      if (!module.course || module.course === 'unknown') {
        module.course = this.inferCourseFromText(module.title + ' ' + (module.keyTopics || ''));
      }
    });

    // Validate and fix assignment dates
    results.assignments.forEach(assignment => {
      if (!assignment.date || new Date(assignment.date) < new Date()) {
        // Set reasonable future date
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        assignment.date = futureDate.toISOString().split('T')[0];
      }
    });

    // Final deduplication
    results.assignments = this.deduplicateAssignments(results.assignments);

    // Sort assignments by date
    results.assignments.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });

    // Add metadata
    results.metadata.assignmentsFound = results.assignments.length;
    results.metadata.modulesFound = results.modules.length;
    results.metadata.eventsFound = results.events.length;
    results.metadata.processingTime = Date.now();
  }

  deduplicateAssignments(assignments) {
    const unique = [];
    const seen = new Set();
    
    assignments.forEach(assignment => {
      const key = `${assignment.text.toLowerCase()}-${assignment.date}-${assignment.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(assignment);
      }
    });
    
    return unique;
  }

  generateId() {
    return `regex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default RegexDocumentParser;