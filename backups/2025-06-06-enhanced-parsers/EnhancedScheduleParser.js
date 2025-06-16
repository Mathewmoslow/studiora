// src/services/EnhancedScheduleParser.js
import { ScheduleParser } from './DocumentParsers.js';
import { DocumentTypeConfigs } from './config/DocumentTypeConfigs.js';

export class EnhancedScheduleParser extends ScheduleParser {
  constructor(config = {}) {
    super();
    
    // Store raw config
    this.rawConfig = config;
    
    // Build full configuration using DocumentTypeConfigs
    this.config = DocumentTypeConfigs.buildConfig(
      config.course || '',
      config.documentText || '',
      config
    );
    
    console.log(`🎯 Detected domain: ${this.config.domainName}`);
  }
  
  parse(text, course) {
    // Update config with document text for better domain detection
    this.config = DocumentTypeConfigs.buildConfig(course, text, this.rawConfig);
    
    const assignments = [];
    const modules = [];
    
    // Pre-process text
    const normalizedText = this.normalizeText(text);
    const lines = normalizedText.split('\n');
    
    // Initialize parsing state
    this.state = {
      currentWeek: null,
      currentDate: null,
      dateScope: null,
      lastHeaderLine: -1,
      domain: this.config.domain
    };
    
    // Build structure map
    const structureMap = this.buildStructureMap(lines);
    
    // Extract assignments with context
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      this.updateContext(i, structureMap);
      
      if (this.isWeekHeader(line)) {
        const weekInfo = this.parseWeekHeader(line);
        this.state.currentWeek = weekInfo.week;
        modules.push({
          number: weekInfo.week,
          title: weekInfo.title || `Week ${weekInfo.week}`,
          course: course
        });
      }
      
      if (this.isDateHeader(line, i, lines)) {
        this.state.currentDate = this.extractDateFromHeader(line);
        this.state.dateScope = this.determineDateScope(i, lines);
      }
      
      const assignment = this.extractAssignment(line, i, lines, course);
      if (assignment && !this.isDuplicate(assignment, assignments)) {
        assignments.push(assignment);
      }
    }
    
    // Find missed assignments
    const missedAssignments = this.findMissedAssignments(text, assignments);
    assignments.push(...missedAssignments);
    
    return { 
      assignments: this.sortAndCleanAssignments(assignments), 
      modules,
      metadata: {
        domain: this.config.domain,
        domainName: this.config.domainName
      }
    };
  }
  
  normalizeText(text) {
    return text
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/\s*[:：]\s*/g, ': ')
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }
  
  buildStructureMap(lines) {
    const map = {
      weeks: new Map(),
      dates: new Map(),
      sections: []
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (this.isWeekHeader(line)) {
        const weekInfo = this.parseWeekHeader(line);
        map.weeks.set(i, weekInfo);
        map.sections.push({ 
          type: 'week', 
          start: i, 
          end: this.findSectionEnd(i, lines),
          data: weekInfo 
        });
      }
      
      if (this.isDateHeader(line, i, lines)) {
        const date = this.extractDateFromHeader(line);
        if (date) {
          map.dates.set(i, date);
          map.sections.push({ 
            type: 'date', 
            start: i, 
            end: this.findSectionEnd(i, lines),
            date: date 
          });
        }
      }
    }
    
    return map;
  }
  
  isWeekHeader(line) {
    return /^(Week|Module)\s+\d+/i.test(line);
  }
  
  parseWeekHeader(line) {
    const match = line.match(/^(Week|Module)\s+(\d+)\s*(?:\([^)]+\))?\s*:?\s*(.*)$/i);
    if (!match) return null;
    
    return {
      type: match[1].toLowerCase(),
      week: parseInt(match[2]),
      title: match[3]?.trim() || null
    };
  }
  
  isDateHeader(line, lineIndex, lines) {
    const patterns = [
      /^\*+\s*\w+\s+\w+\s+\d+/,
      /^\w+\s+\w+\s+\d+\s*[-:]/,
      /^\w+\s+\d+\s*:/,
      /^\*+\s*\w+\s+\d+\s*\*+/,
      /^#{1,4}\s*\w+\s+\d+/,
    ];
    
    const hasDatePattern = patterns.some(p => p.test(line));
    const hasContentBelow = lineIndex < lines.length - 1 && 
                           lines[lineIndex + 1].trim().length > 0;
    
    return hasDatePattern && (hasContentBelow || line.includes(':'));
  }
  
  extractDateFromHeader(line) {
    const patterns = [
      /(\w+\s+\d{1,2})(?:\s*[-:,]|\s*$)/,
      /(\w+)\s+(\d{1,2})/,
      /(\d{1,2}\/\d{1,2})/,
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return this.parseDate(match[0]);
      }
    }
    
    return null;
  }
  
  determineDateScope(lineIndex, lines) {
    let endIndex = lineIndex + 1;
    
    while (endIndex < lines.length) {
      const line = lines[endIndex].trim();
      
      if (!line) {
        if (endIndex + 1 < lines.length && this.isDateHeader(lines[endIndex + 1], endIndex + 1, lines)) {
          break;
        }
      }
      
      if (this.isWeekHeader(line) || this.isDateHeader(line, endIndex, lines)) {
        break;
      }
      
      endIndex++;
    }
    
    return { start: lineIndex, end: endIndex };
  }
  
  updateContext(lineIndex, structureMap) {
    for (const section of structureMap.sections) {
      if (lineIndex >= section.start && lineIndex <= section.end) {
        if (section.type === 'week') {
          this.state.currentWeek = section.data.week;
        } else if (section.type === 'date') {
          this.state.currentDate = section.date;
        }
      }
    }
  }
  
  containsAssignmentKeywords(line) {
    const lowerLine = line.toLowerCase();
    
    // Check domain-specific keywords first
    return this.config.keywords.some(keyword => 
      lowerLine.includes(keyword.toLowerCase())
    );
  }
  
  extractAssignment(line, lineIndex, lines, course) {
    if (this.isWeekHeader(line) || this.isDateHeader(line, lineIndex, lines)) {
      return null;
    }
    
    // Domain-aware assignment patterns
    const assignmentPatterns = [
      // Quiz patterns
      {
        pattern: /Quiz\s+(\d+)\s*:\s*([^(]+)(?:\s*\((\d+)\s*(?:pts?|points?)\))?.*?(?:Due:\s*([^)]+))?/i,
        type: 'quiz',
        extract: (match) => ({
          text: `Quiz ${match[1]}: ${match[2].trim()}`,
          points: match[3] ? parseInt(match[3]) : null,
          dueTime: match[4]?.trim()
        })
      },
      // Domain-specific patterns based on config
      ...this.getDomainSpecificPatterns(),
      // Generic patterns
      {
        pattern: /^[-•*]\s*(.+?)(?:\s*\((?:Due:\s*)?([^)]+)\))?$/,
        type: 'assignment',
        extract: (match) => ({
          text: match[1].trim(),
          dueTime: match[2]?.trim()
        })
      }
    ];
    
    for (const { pattern, type, extract } of assignmentPatterns) {
      const match = line.match(pattern);
      if (match) {
        const extracted = extract(match);
        
        let assignmentDate = this.state.currentDate;
        const lineDate = this.extractDateFromLine(line);
        if (lineDate) {
          assignmentDate = lineDate;
        }
        
        return {
          id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: extracted.text,
          date: assignmentDate,
          points: extracted.points || null,
          type: this.determineType(extracted.text, type),
          hours: this.estimateHours(extracted.text, type),
          course: course,
          week: this.state.currentWeek,
          dueTime: extracted.dueTime,
          source: 'schedule',
          confidence: 0.85,
          lineIndex: lineIndex,
          domain: this.config.domain
        };
      }
    }
    
    if (this.containsAssignmentKeywords(line)) {
      return {
        id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: line.replace(/^[-•*]\s*/, '').trim(),
        date: this.state.currentDate,
        type: this.determineType(line),
        hours: this.estimateHours(line),
        course: course,
        week: this.state.currentWeek,
        source: 'schedule',
        confidence: 0.7,
        lineIndex: lineIndex,
        domain: this.config.domain
      };
    }
    
    return null;
  }
  
  getDomainSpecificPatterns() {
    const patterns = [];
    
    // Add nursing-specific patterns
    if (this.config.domain === 'nursing') {
      patterns.push(
        {
          pattern: /HESI\s+(?:Exam\s+Prep:\s*)?([^(]+?)(?:\s*Exam)?(?:\s*\((\d+)\s*(?:pts?|points?)(?:,?\s*Due:\s*([^)]+))?\))?/i,
          type: 'exam',
          extract: (match) => ({
            text: `HESI ${match[1].trim()}${match[0].includes('Prep') ? ' Exam Prep' : ' Exam'}`,
            points: match[2] ? parseInt(match[2]) : 50,
            dueTime: match[3]?.trim()
          })
        },
        {
          pattern: /Clinical\s+(?:rotation|shift):\s*([^(]+)(?:\s*\(([^)]+)\))?/i,
          type: 'clinical',
          extract: (match) => ({
            text: `Clinical: ${match[1].trim()}`,
            details: match[2]?.trim()
          })
        }
      );
    }
    
    // Add CS-specific patterns
    if (this.config.domain === 'engineering') {
      patterns.push(
        {
          pattern: /Lab\s+(\d+)\s*:\s*([^(]+)(?:\s*\(Due:\s*([^)]+)\))?/i,
          type: 'lab',
          extract: (match) => ({
            text: `Lab ${match[1]}: ${match[2].trim()}`,
            dueTime: match[3]?.trim()
          })
        },
        {
          pattern: /(?:Code\s+Review|Sprint)\s*:\s*([^(]+)(?:\s*\(([^)]+)\))?/i,
          type: 'project',
          extract: (match) => ({
            text: match[0].split(':')[0] + ': ' + match[1].trim(),
            details: match[2]?.trim()
          })
        }
      );
    }
    
    // Add more domain patterns as needed...
    
    return patterns;
  }
  
  extractDateFromLine(line) {
    const datePatterns = [
      /(?:Due:\s*)?(\w+\s+\d{1,2})(?:\s|,|$)/,
      /(?:Due:\s*)?(\d{1,2}\/\d{1,2})/,
      /\((\w+\s+\d{1,2})\)/
    ];
    
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        return this.parseDate(match[1]);
      }
    }
    
    return null;
  }
  
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      let cleanDate = dateStr.trim()
        .replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s*/i, '')
        .replace(/[:.]$/, '');
      
      if (!cleanDate.match(/\d{4}/)) {
        cleanDate += `, ${this.config.defaultYear}`;
      }
      
      const date = new Date(cleanDate);
      
      // Validate against semester bounds if configured
      if (this.config.semesterStart && this.config.semesterEnd) {
        const start = new Date(this.config.semesterStart);
        const end = new Date(this.config.semesterEnd);
        
        if (date < start || date > end) {
          console.warn(`⚠️ Date ${date.toISOString().split('T')[0]} outside semester bounds`);
        }
      }
      
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Failed to parse date:', dateStr);
    }
    
    return null;
  }
  
  determineType(text, suggestedType = null) {
    if (suggestedType) return suggestedType;
    
    // Use domain-specific type detection
    return DocumentTypeConfigs.determineType(text, this.config.domain);
  }
  
  estimateHours(text, type = null) {
    const actualType = type || this.determineType(text);
    
    // Use domain-specific hour estimates
    return DocumentTypeConfigs.getHourEstimate(actualType, this.config.domain);
  }
  
  findSectionEnd(startIndex, lines) {
    let endIndex = startIndex + 1;
    
    while (endIndex < lines.length) {
      const line = lines[endIndex].trim();
      
      if (this.isWeekHeader(line) || 
          (line && this.isDateHeader(line, endIndex, lines))) {
        return endIndex - 1;
      }
      
      endIndex++;
    }
    
    return lines.length - 1;
  }
  
  isDuplicate(assignment, existingAssignments) {
    return existingAssignments.some(existing => {
      if (existing.text === assignment.text) return true;
      
      if (existing.date === assignment.date) {
        const similarity = this.calculateSimilarity(existing.text, assignment.text);
        if (similarity > 0.8) return true;
      }
      
      return false;
    });
  }
  
  calculateSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords.length / totalWords;
  }
  
  findMissedAssignments(originalText, foundAssignments) {
    const missed = [];
    
    const missedPatterns = [
      /Quiz\s+\d+[^(\n]+\n[^(\n]+\(\d+\s*points[^)]*\)/gi,
      /(?:Complete|Submit|Due)[^:\n]+:\n\s*([^\n]+)/gi
    ];
    
    for (const pattern of missedPatterns) {
      let match;
      while ((match = pattern.exec(originalText)) !== null) {
        const text = match[0].replace(/\n\s*/g, ' ').trim();
        
        if (!foundAssignments.some(a => a.text.includes(text.substring(0, 20)))) {
          const assignment = this.parseAssignmentFromText(text);
          if (assignment) {
            missed.push(assignment);
          }
        }
      }
    }
    
    return missed;
  }
  
  parseAssignmentFromText(text) {
    const assignment = {
      id: `schedule_missed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text,
      type: this.determineType(text),
      hours: this.estimateHours(text),
      source: 'schedule-recovery',
      confidence: 0.6,
      domain: this.config.domain
    };
    
    const dateMatch = text.match(/(?:Due:\s*)?(\w+\s+\d{1,2})/);
    if (dateMatch) {
      assignment.date = this.parseDate(dateMatch[1]);
    }
    
    const pointsMatch = text.match(/(\d+)\s*(?:pts?|points?)/i);
    if (pointsMatch) {
      assignment.points = parseInt(pointsMatch[1]);
    }
    
    return assignment;
  }
  
  sortAndCleanAssignments(assignments) {
    return assignments
      .filter(a => a.text && a.text.length > 3)
      .sort((a, b) => {
        if (a.date && b.date) {
          return new Date(a.date) - new Date(b.date);
        }
        if (a.date && !b.date) return -1;
        if (!a.date && b.date) return 1;
        
        return (a.lineIndex || 0) - (b.lineIndex || 0);
      })
      .map((a, idx) => ({
        ...a,
        id: a.id || `schedule_final_${Date.now()}_${idx}`
      }));
  }
}