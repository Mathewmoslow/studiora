// src/services/StudioraDualParser.js
import { StudiorAIService } from './StudiorAIService.js';
import { RegexDocumentParser } from './RegexDocumentParser.js';
import { 
  CanvasModulesParser, 
  CanvasAssignmentsParser, 
  SyllabusParser, 
  ScheduleParser,
  DocumentParsers 
} from './DocumentParsers.js';

export class StudioraDualParser {
  constructor(apiKey, options = {}) {
    this.regexParser = new RegexDocumentParser();
    this.aiService = new StudiorAIService(apiKey, options);
    
    // Initialize document-specific parsers
    this.documentParsers = {
      'canvas-modules': new CanvasModulesParser(),
      'canvas-assignments': new CanvasAssignmentsParser(),
      'syllabus': new SyllabusParser(),
      'schedule': new ScheduleParser(),
      'mixed': this.regexParser
    };
  }

  async parse(text, options = {}, onProgress = null) {
    const { course, documentType = 'mixed', userCourses = [] } = options;
    
    console.log('🎓 Studiora: Starting sequential parsing...');
    console.log('📄 Document type:', documentType);
    console.log('📚 Course:', course);
    
    onProgress?.({ 
      stage: 'starting', 
      message: 'Initializing parser...'
    });
    
    try {
      // STAGE 1: Regex parsing
      onProgress?.({ stage: 'regex', message: 'Scanning for assignments...' });
      
      const regexResults = await this.parseWithRegex(text, course, documentType);
      
      console.log('📊 Regex found:', regexResults.assignments.length, 'assignments');
      onProgress?.({ 
        stage: 'regex-complete', 
        message: `Found ${regexResults.assignments.length} assignments`,
        results: regexResults 
      });
      
      // If no AI key, return regex results
      if (!this.aiService.apiKey) {
        console.log('ℹ️ No AI key provided, returning regex results only');
        return this.formatFinalResults(
          regexResults.assignments,
          regexResults,
          { assignments: [] },
          'Regex only - no AI enhancement'
        );
      }
      
      // STAGE 2: AI analyzes remainder
      onProgress?.({ stage: 'ai-remainder', message: 'AI analyzing remaining text...' });
      
      const remainingText = this.removeFoundContent(text, regexResults.assignments);
      console.log('📄 Remaining text length:', remainingText.length, 'characters');
      
      let aiRemainderResults = { assignments: [] };
      if (remainingText.length > 100) {
        aiRemainderResults = await this.aiAnalyzeRemainder(remainingText, regexResults);
        console.log('🤖 AI found', aiRemainderResults.assignments.length, 'additional assignments');
      }
      
      // STAGE 3: AI validates regex results
      onProgress?.({ stage: 'ai-validate', message: 'AI validating regex results...' });
      
      const validatedResults = await this.aiValidateResults(
        text, 
        regexResults, 
        course, 
        documentType
      );
      console.log('✅ AI validated', validatedResults.assignments.length, 'assignments');
      
      // STAGE 4: Merge all results
      onProgress?.({ stage: 'merging', message: 'Consolidating results...' });
      
      const finalAssignments = this.mergeResults(
        validatedResults.assignments,
        aiRemainderResults.assignments
      );
      
      console.log('✨ Final result:', finalAssignments.length, 'total assignments');
      
      const finalResults = this.formatFinalResults(
        finalAssignments,
        regexResults,
        aiRemainderResults,
        `Sequential: ${finalAssignments.length} assignments`
      );
      
      onProgress?.({ 
        stage: 'complete', 
        message: 'Parsing complete!',
        results: finalResults
      });
      
      return finalResults;
      
    } catch (error) {
      console.error('❌ Studiora parsing failed:', error);
      onProgress?.({ stage: 'error', message: error.message, error });
      throw error;
    }
  }

  async parseWithRegex(text, course, documentType = 'mixed') {
    const parser = this.documentParsers[documentType] || this.documentParsers['mixed'];
    
    console.log(`📄 Using parser:`, parser.constructor.name);
    
    let results;
    if (documentType === 'mixed' || !this.documentParsers[documentType]) {
      results = parser.parse(text);
    } else {
      results = parser.parse(text, course);
    }
    
    const assignments = (results.assignments || []).map((assignment, idx) => ({
      ...assignment,
      id: assignment.id || `regex_${Date.now()}_${idx}`,
      course: assignment.course || course || 'unknown',
      source: `regex-${documentType}`,
      extractedFrom: assignment.extractedFrom || null
    }));
    
    return {
      assignments,
      modules: results.modules || [],
      events: results.events || [],
      confidence: this.calculateConfidence({ assignments }),
      source: `regex-${documentType}`,
      documentType: documentType,
      parserUsed: parser.constructor.name,
      timestamp: Date.now()
    };
  }

  removeFoundContent(originalText, foundAssignments) {
    let remainingText = originalText;
    
    const sortedAssignments = [...foundAssignments].sort((a, b) => {
      const posA = a.extractedFrom ? originalText.indexOf(a.extractedFrom) : -1;
      const posB = b.extractedFrom ? originalText.indexOf(b.extractedFrom) : -1;
      return posB - posA;
    });
    
    sortedAssignments.forEach(assignment => {
      if (assignment.extractedFrom) {
        const placeholder = '\n[EXTRACTED BY REGEX]\n';
        remainingText = remainingText.replace(assignment.extractedFrom, placeholder);
      } else if (assignment.text) {
        const searchPattern = assignment.text.substring(0, 50);
        const index = remainingText.indexOf(searchPattern);
        if (index !== -1) {
          const before = remainingText.substring(0, Math.max(0, index - 20));
          const after = remainingText.substring(index + searchPattern.length + 20);
          remainingText = before + '\n[EXTRACTED BY REGEX]\n' + after;
        }
      }
    });
    
    remainingText = remainingText.replace(/(\[EXTRACTED BY REGEX\]\s*)+/g, '[EXTRACTED BY REGEX]\n');
    
    return remainingText;
  }

  async aiAnalyzeRemainder(remainingText, regexResults) {
    try {
      const prompt = `
You are analyzing the REMAINING text after regex extraction. The regex parser already found ${regexResults.assignments.length} assignments.

REMAINING TEXT:
${remainingText}

Look for assignments the regex missed. These might be:
- Implicit assignments ("prepare for class", "review before exam")
- Assignments in unusual formats
- Clinical or lab preparations
- Activities not matching standard patterns

Return ONLY assignments NOT already found by regex.

Respond with JSON:
{
  "assignments": [
    {
      "text": "Assignment description",
      "date": "YYYY-MM-DD or null",
      "type": "assignment|quiz|exam|reading|lab|clinical|activity",
      "hours": 1.5,
      "course": "${regexResults.assignments[0]?.course || 'unknown'}"
    }
  ]
}`;

      const result = await this.aiService.makeRequest(prompt, 'json');
      
      return {
        assignments: (result.assignments || []).map((a, idx) => ({
          ...a,
          id: `ai_remainder_${Date.now()}_${idx}`,
          source: 'ai-remainder',
          confidence: 0.7
        }))
      };
      
    } catch (error) {
      console.warn('⚠️ AI remainder analysis failed:', error.message);
      return { assignments: [] };
    }
  }

  async aiValidateResults(originalText, regexResults, course, documentType) {
    try {
      const contextWindow = Math.min(originalText.length, 3000);
      const prompt = `
You are validating ${regexResults.assignments.length} assignments extracted from a ${documentType} document.

DOCUMENT CONTEXT (first ${contextWindow} chars):
${originalText.substring(0, contextWindow)}

EXTRACTED ASSIGNMENTS:
${JSON.stringify(regexResults.assignments.slice(0, 50), null, 2)}
${regexResults.assignments.length > 50 ? `\n... and ${regexResults.assignments.length - 50} more assignments` : ''}

VALIDATION TASKS:
1. Verify each assignment is real (not a header or description)
2. Fix any dates - convert to YYYY-MM-DD format
3. Add missing information from context
4. Remove any obvious false positives

Current date context: ${new Date().toISOString().split('T')[0]}
Course: ${course}

Respond with JSON:
{
  "validatedAssignments": [
    {
      "id": "original assignment id",
      "text": "Corrected/validated text",
      "date": "YYYY-MM-DD",
      "type": "type",
      "hours": 1.5,
      "course": "${course}",
      "isValid": true,
      "changes": ["what was fixed"]
    }
  ],
  "invalidIds": ["id1", "id2"]
}`;

      const result = await this.aiService.makeRequest(prompt, 'json');
      
      // Apply validation results
      const validatedAssignments = regexResults.assignments.map(assignment => {
        const validation = (result.validatedAssignments || []).find(v => v.id === assignment.id);
        
        if (validation) {
          return {
            ...assignment,
            ...validation,
            source: 'regex-ai-validated'
          };
        }
        
        // Check if marked invalid
        if ((result.invalidIds || []).includes(assignment.id)) {
          return null; // Will be filtered out
        }
        
        return assignment; // Keep as-is
      }).filter(Boolean); // Remove nulls
      
      return {
        assignments: validatedAssignments,
        modules: regexResults.modules,
        events: regexResults.events
      };
      
    } catch (error) {
      console.warn('⚠️ AI validation failed:', error.message);
      return regexResults; // Return original if validation fails
    }
  }

  mergeResults(validatedAssignments, remainderAssignments) {
    const allAssignments = [...validatedAssignments, ...remainderAssignments];
    
    // Simple deduplication based on text similarity
    const uniqueMap = new Map();
    
    allAssignments.forEach(assignment => {
      const key = `${assignment.text?.toLowerCase().substring(0, 30)}_${assignment.date || 'nodate'}`;
      
      if (!uniqueMap.has(key) || assignment.source === 'regex-ai-validated') {
        // Prefer validated versions
        uniqueMap.set(key, assignment);
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  formatFinalResults(assignments, regexResults, aiRemainderResults, summary) {
    return {
      assignments: assignments,
      modules: regexResults.modules || [],
      events: regexResults.events || [],
      metadata: {
        method: 'sequential',
        confidence: this.calculateConfidence({ assignments }),
        regexFound: regexResults.assignments?.length || 0,
        aiFoundInRemainder: aiRemainderResults.assignments?.length || 0,
        totalFinal: assignments.length,
        summary: summary,
        stages: {
          regex: 'completed',
          aiRemainder: aiRemainderResults.assignments?.length > 0 ? 'found-additional' : 'none-found',
          aiValidation: 'completed',
          consolidation: 'completed'
        }
      }
    };
  }

  calculateConfidence(results) {
    if (!results.assignments || results.assignments.length === 0) return 0.1;
    
    let confidence = 0.5;
    
    const withDates = results.assignments.filter(a => a.date).length;
    confidence += (withDates / results.assignments.length) * 0.3;
    
    const withPoints = results.assignments.filter(a => a.points).length;
    confidence += (withPoints / results.assignments.length) * 0.1;
    
    if (results.assignments.length >= 5 && results.assignments.length <= 100) {
      confidence += 0.1;
    }
    
    return Math.min(0.95, confidence);
  }
}

export default StudioraDualParser;