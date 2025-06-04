// src/services/StudioraDualParser.js
// Option 5: Sequential Enhancement (Regex First + AI Remaining Text)

import { RegexDocumentParser } from './RegexDocumentParser';
import { StudiorAIService } from './StudiorAIService';

export class StudioraDualParser {
  constructor() {
    this.parsers = {
      'canvas-modules': new CanvasModulesParser(),
      'canvas-assignments': new CanvasAssignmentsParser(),
      'syllabus': new SyllabusParser(),
      'schedule': new ScheduleParser(), // Similar implementation
      'mixed': new MixedParser() // Current approach with fixed inference
    };
  }

  async parse(text, options = {}, onProgress) {
    const { course, documentType = 'mixed', userCourses = [] } = options;
    
    onProgress?.({ stage: 'starting', message: `Initializing ${documentType} parser...` });
    
    // Use the appropriate parser
    const parser = this.parsers[documentType] || this.parsers['mixed'];
    
    onProgress?.({ stage: 'parsing', message: `Parsing ${documentType} content...` });
    
    const results = parser.parse(text, course);
    
    // If we have AI enhancement enabled, enhance the results
    if (options.useAI && documentType !== 'mixed') {
      onProgress?.({ stage: 'ai', message: 'AI enhancing results...' });
      results.assignments = await this.enhanceWithAI(text, results.assignments, course, documentType);
    }
    
    onProgress?.({ stage: 'complete', message: 'Parsing complete!' });
    
    return {
      ...results,
      metadata: {
        method: `${documentType}-parser${options.useAI ? '-ai-enhanced' : ''}`,
        confidence: this.calculateConfidence(results),
        course: course.code,
        documentType: documentType,
        summary: `Found ${results.assignments.length} assignments using ${documentType} parser`
      }
    };
  }
  
  calculateConfidence(results) {
    if (!results.assignments.length) return 0;
    
    // Higher confidence if we found dates, points, proper structure
    let confidence = 0.7;
    const withDates = results.assignments.filter(a => a.date).length;
    const withPoints = results.assignments.filter(a => a.points).length;
    
    confidence += (withDates / results.assignments.length) * 0.2;
    confidence += (withPoints / results.assignments.length) * 0.1;
    
    return Math.min(0.95, confidence);
  }

  removeFoundContent(originalText, foundAssignments) {
    let remainingText = originalText;
    
    // Remove text that regex already found assignments in
    foundAssignments.forEach(assignment => {
      if (assignment.extractedFrom) {
        // Simple removal - replace found text with placeholder
        remainingText = remainingText.replace(assignment.extractedFrom, '[PARSED_BY_REGEX]');
      }
    });
    
    return remainingText;
  }

  async parseRemainingWithAI(remainingText, alreadyFoundCount) {
    if (remainingText.length < 100) {
      return { assignments: [], modules: [], events: [], confidence: 1.0 };
    }

    try {
      // Use OpenAI Function Calling for structured output
      const result = await this.aiService.parseWithFunctionCalling(remainingText, {
        alreadyFoundCount,
        instruction: 'Find assignments that regex missed in this remaining text'
      });

      return {
        assignments: result.assignments || [],
        modules: result.modules || [],
        events: result.events || [],
        confidence: 0.85,
        source: 'ai-additional',
        timestamp: Date.now(),
        parsingId: this.parsingId
      };
      
    } catch (error) {
      console.warn('⚠️ AI additional parsing failed:', error.message);
      return {
        assignments: [],
        modules: [],
        events: [],
        error: error.message,
        confidence: 0,
        source: 'ai-additional'
      };
    }
  }

  mergeResults(regexResults, aiResults) {
    // Simple merge - no complex reconciliation needed
    const allAssignments = [
      ...regexResults.assignments.map(a => ({ ...a, source: 'regex-found' })),
      ...aiResults.assignments.map(a => ({ ...a, source: 'ai-additional' }))
    ];

    // Basic deduplication
    const uniqueAssignments = this.deduplicateAssignments(allAssignments);

    const finalResults = {
      assignments: uniqueAssignments,
      modules: [...(regexResults.modules || []), ...(aiResults.modules || [])],
      events: [...(regexResults.events || []), ...(aiResults.events || [])],
      learningObjectives: aiResults.learningObjectives || {},
      studyHints: aiResults.studyHints || [],
      workloadWarnings: aiResults.workloadWarnings || [],
      metadata: {
        method: 'sequential-enhancement',
        confidence: this.calculateFinalConfidence(regexResults, aiResults, uniqueAssignments),
        regexFound: regexResults.assignments.length,
        aiAdditional: aiResults.assignments.length,
        totalUnique: uniqueAssignments.length,
        summary: `Sequential: ${regexResults.assignments.length} regex + ${aiResults.assignments.length} AI additional = ${uniqueAssignments.length} total`,
        parsingId: this.parsingId
      },
      rawResults: {
        regex: regexResults,
        ai: aiResults
      },
      timestamp: Date.now(),
      version: '2.0.0',
      appName: 'Studiora'
    };

    // Debug logging
    console.log('🔍 Final assignments being returned:', finalResults.assignments.length);
    console.log('🔍 Events being returned:', finalResults.events.length);
    console.log('🔍 Total items:', finalResults.assignments.length + finalResults.events.length);

    return finalResults;
  }

  calculateRegexConfidence(results, text) {
    let confidence = 0;
    
    const textLength = text.length;
    const assignmentDensity = results.assignments.length / (textLength / 1000);
    confidence += Math.min(0.4, assignmentDensity * 0.05);
    
    const assignmentsWithDates = results.assignments.filter(a => a.date).length;
    if (results.assignments.length > 0) {
      confidence += (assignmentsWithDates / results.assignments.length) * 0.3;
    }
    
    if (results.modules?.length > 0) confidence += 0.2;
    if (text.includes('Module') || text.includes('Week')) confidence += 0.1;
    if (text.includes('Assignment') || text.includes('Quiz')) confidence += 0.1;
    if (text.includes('Syllabus') || text.includes('Course')) confidence += 0.1;
    
    if (results.errors?.length > 0) {
      confidence -= Math.min(0.3, results.errors.length * 0.05);
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  calculateFinalConfidence(regexResults, aiResults, finalAssignments) {
    const regexWeight = regexResults.assignments.length / finalAssignments.length;
    const aiWeight = aiResults.assignments.length / finalAssignments.length;
    
    return (regexResults.confidence * regexWeight) + 
           ((aiResults.confidence || 0.85) * aiWeight);
  }

  deduplicateAssignments(assignments) {
    const unique = [];
    
    for (const assignment of assignments) {
      const isDuplicate = unique.some(existing => 
        this.calculateTextSimilarity(existing.text, assignment.text) > 0.8 &&
        existing.date === assignment.date
      );
      
      if (!isDuplicate) {
        unique.push(assignment);
      }
    }
    
    return unique;
  }

  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }
}

export default StudioraDualParser;