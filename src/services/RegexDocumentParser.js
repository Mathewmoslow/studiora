// src/services/RegexDocumentParser.js
// General-purpose regex parser for mixed document types

export class RegexDocumentParser {
  constructor() {
    this.patterns = {
      assignments: [
        // Standard date-based patterns
        /(?:due|submit|complete)?\s*:?\s*([^,\n]+?)\s*(?:due|by|on)?\s*:?\s*(\w+\s+\d{1,2}(?:,?\s+\d{4})?)/gi,
        /(\w+\s+\d{1,2}(?:,?\s+\d{4})?)\s*[-–:]\s*([^,\n]+)/gi,
        
        // Sherpath/External tool patterns
        /Sherpath:\s*([^-\n]+?)\s*-\s*Due\s+(\w+\s+\d{1,2},?\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi,
        /([^:\n]+?):\s*Due\s+(\w+\s+\d{1,2},?\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi,
        
        // Points-based patterns
        /([^,\n]+?)\s*\((\d+)\s*(?:pts?|points)\)\s*(?:due|by)?\s*:?\s*(\w+\s+\d{1,2})/gi,
        /([^,\n]+?)\s*(?:due|by)?\s*:?\s*(\w+\s+\d{1,2})\s*\((\d+)\s*(?:pts?|points)\)/gi,
        
        // Module/Week patterns
        /(?:Week|Module)\s*\d+\s*[-–:]\s*([^,\n]+?)\s*(?:due|by)?\s*:?\s*(\w+\s+\d{1,2})/gi,
        
        // Clinical/Lab patterns
        /(?:Clinical|Lab|Simulation)\s*[-–:]\s*([^,\n]+?)\s*(?:on|at)?\s*(\w+\s+\d{1,2})/gi,
        
        // Reading assignments
        /Read(?:ing)?:?\s*([^,\n]+?)\s*(?:by|before)?\s*(\w+\s+\d{1,2})/gi,
        
        // Canvas-style patterns
        /^([^\t\n]+?)\s+(\w+\s+\d{1,2})\s+at\s+(\d{1,2}:\d{2})\s*(am|pm)/gmi,
        
        // Numeric date patterns
        /([^,\n]+?)\s*(?:due|by)?\s*:?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/gi
      ],
      
      modules: [
        /^(Module|Week|Unit)\s*(\d+)\s*[-–:]\s*([^\n]+)/gmi,
        /^(Chapter)\s*(\d+(?:\s*[-–&,]\s*\d+)*)\s*[-–:]\s*([^\n]+)/gmi
      ],
      
      events: [
        /(?:Exam|Test|Quiz|Midterm|Final)\s*[-–:]\s*([^,\n]+?)\s*(?:on|at)?\s*(\w+\s+\d{1,2})/gi,
        /(\w+\s+\d{1,2})\s*[-–:]\s*(?:Exam|Test|Quiz|Midterm|Final)\s*[-–:]\s*([^,\n]+)/gi
      ]
    };
  }

  parse(text) {
    const assignments = [];
    const modules = [];
    const events = [];
    const extractedTexts = new Set();

    // Parse modules first
    for (const pattern of this.patterns.modules) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        modules.push({
          type: match[1],
          number: match[2],
          title: match[3].trim(),
          assignments: []
        });
      }
    }

    // Parse assignments
    for (const pattern of this.patterns.assignments) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        if (extractedTexts.has(fullMatch)) continue;
        
        // Extract components based on pattern structure
        let assignmentText, dateStr, points;
        
        if (match.length === 5) {
          // Sherpath/time-based pattern
          assignmentText = match[1];
          dateStr = match[2];
        } else if (match.length === 4) {
          // Points-based pattern
          if (/\d+/.test(match[2])) {
            assignmentText = match[1];
            points = parseInt(match[2]);
            dateStr = match[3];
          } else {
            assignmentText = match[1];
            dateStr = match[2];
            points = parseInt(match[3]) || null;
          }
        } else {
          // Standard pattern
          assignmentText = match[1];
          dateStr = match[2];
        }

        // Clean up assignment text
        assignmentText = this.cleanText(assignmentText);
        
        if (assignmentText && assignmentText.length > 3) {
          const assignment = {
            id: `regex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: assignmentText,
            date: this.parseDate(dateStr),
            type: this.determineType(assignmentText),
            hours: this.estimateHours(assignmentText, points),
            points: points || null,
            source: 'regex',
            confidence: 0.7,
            extractedFrom: fullMatch
          };
          
          assignments.push(assignment);
          extractedTexts.add(fullMatch);
        }
      }
    }

    // Parse events
    for (const pattern of this.patterns.events) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        if (extractedTexts.has(fullMatch)) continue;
        
        events.push({
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: match[2] || match[1],
          date: this.parseDate(match[1] || match[2]),
          type: 'exam',
          source: 'regex'
        });
        
        extractedTexts.add(fullMatch);
      }
    }

    return { assignments, modules, events };
  }

  cleanText(text) {
    return text
      .replace(/^[-–•*]\s*/, '')
      .replace(/\s+/g, ' ')
      .replace(/["""]/g, '"')
      .replace(/['']/g, "'")
      .trim();
  }

  determineType(text) {
    const types = {
      'reading': /\b(?:read|chapter|pages?|textbook)\b/i,
      'quiz': /\bquiz\b/i,
      'exam': /\b(?:exam|test|midterm|final|hesi)\b/i,
      'assignment': /\b(?:assignment|homework|worksheet)\b/i,
      'project': /\b(?:project|presentation)\b/i,
      'paper': /\b(?:paper|essay|report|write|writing)\b/i,
      'lab': /\b(?:lab|laboratory)\b/i,
      'clinical': /\b(?:clinical|simulation|sim)\b/i,
      'discussion': /\b(?:discussion|forum|post|respond)\b/i,
      'video': /\b(?:video|watch|view)\b/i,
      'review': /\b(?:review|practice|prep)\b/i
    };

    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type;
    }

    return 'assignment';
  }

  estimateHours(text, points) {
    let hours = 1.5;

    if (points) {
      if (points >= 50) hours = 3;
      else if (points >= 30) hours = 2;
      else if (points >= 10) hours = 1.5;
      else hours = 1;
    }

    if (/\b(?:exam|test|midterm|final)\b/i.test(text)) {
      hours = Math.max(3, hours);
    } else if (/\bquiz\b/i.test(text)) {
      hours = Math.max(1, hours);
    } else if (/\b(?:paper|essay|report)\b/i.test(text)) {
      hours = Math.max(3, hours);
    } else if (/\bproject\b/i.test(text)) {
      hours = Math.max(4, hours);
    } else if (/\b(?:clinical|simulation)\b/i.test(text)) {
      hours = Math.max(4, hours);
    } else if (/\b(?:chapter|chapters)\s*(\d+)-(\d+)/i.test(text)) {
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
          // Fixed: Use local timezone instead of UTC
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }

      // Handle "Month Day, Year" format
      if (/^\w+\s+\d{1,2},\s*\d{4}$/.test(dateStr.trim())) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          // Fixed: Use local timezone instead of UTC
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
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
          // Fixed: Use local timezone instead of UTC
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      }

      // Try parsing as-is
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // Fixed: Use local timezone instead of UTC
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
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
        
        // Fixed: Use local timezone instead of UTC
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    // Handle relative terms
    if (lowerDate.includes('today')) {
      // Fixed: Use local timezone instead of UTC
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    
    if (lowerDate.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      // Fixed: Use local timezone instead of UTC
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return null;
  }

  // Special handler for Sherpath dates
  parseSherpathDate(dateStr) {
    // Handle "May 11, 2025 at 11:59 PM" format
    const match = dateStr.match(/(\w+\s+\d{1,2},?\s+\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      const datePart = match[1];
      const date = new Date(datePart);
      
      if (!isNaN(date.getTime())) {
        // Fixed: Use local timezone instead of UTC
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    
    return null;
  }
}

export default RegexDocumentParser;