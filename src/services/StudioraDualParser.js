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
    this.regexParser = new RegexDocumentParser(); // Fallback/generic parser
    this.aiService = new StudiorAIService(apiKey, options);
    
    // Initialize document-specific parsers
    this.documentParsers = {
      'canvas-modules': new CanvasModulesParser(),
      'canvas-assignments': new CanvasAssignmentsParser(),
      'syllabus': new SyllabusParser(),
      'schedule': new ScheduleParser(),
      'mixed': this.regexParser // Use generic parser for mixed/unknown content
    };
  }

  // Enhanced document type detection for Canvas content
  detectDocumentType(text, userProvidedType = null) {
    // If user explicitly provided a type, trust it
    if (userProvidedType && userProvidedType !== 'auto') {
      return userProvidedType;
    }
    
    // Canvas Quizzes Page (like ex7)
    if (/Quiz\s+Quiz\s+\d+:/.test(text) && /(?:Due|Closed|Not available until)\s+\w+\s+\d+\s+at/.test(text)) {
      return 'canvas-assignments'; // Use existing parser for quiz listings
    }
    
    // Canvas Modules Page (like ex6)
    if (/Course\s+Modules|External\s+Tool|Assignment\s+.*Dropbox/.test(text) && /\d+\s*pts/.test(text)) {
      return 'canvas-modules';
    }
    
    // Syllabus with Module Learning Outcomes (like ex3, ex4)
    if (/Module\s+(?:Student\s+)?Learning\s+Outcomes?/i.test(text) && /Content\s+Outline/i.test(text)) {
      return 'syllabus';
    }
    
    // Sherpath or other external tools
    if (/Sherpath|Adaptive\s+Quiz|Osmosis\s+Videos/i.test(text)) {
      return 'mixed'; // Let both parsers handle external tool content
    }
    
    // Course schedule/calendar
    if (/Course\s+Calendar|Weekly\s+Schedule|Class\s+Schedule/i.test(text)) {
      return 'schedule';
    }
    
    // Default to mixed for unknown content
    return 'mixed';
  }

  async parse(text, options = {}, onProgress = null) {
    const { course, documentType = 'auto', userCourses = [] } = options;
    
    // Use enhanced detection
    const detectedType = this.detectDocumentType(text, documentType);
    
    console.log('🎓 Studiora: Starting sequential enhancement parsing...');
    console.log('📄 Document type:', detectedType);
    console.log(`📋 Using parser: ${this.documentParsers[detectedType] ? this.documentParsers[detectedType].constructor.name : 'Generic RegexDocumentParser'}`);
    console.log('📚 Course:', course);
    
    onProgress?.({ stage: 'starting', message: `Initializing sequential parser...` });
    
    try {
      // STAGE 1: Regex extracts everything it can find
      onProgress?.({ stage: 'regex', message: 'Regex scanning for assignments...' });
      
      const regexResults = await this.parseWithRegex(text, course, userCourses, detectedType);
      
      console.log('📊 Regex found:', regexResults.assignments.length, 'assignments');
      onProgress?.({ 
        stage: 'regex-complete', 
        message: `Regex found ${regexResults.assignments.length} assignments`,
        results: regexResults 
      });
      
      // STAGE 2: Remove found content and let AI parse remainder
      onProgress?.({ stage: 'ai-remainder', message: 'AI analyzing remaining text...' });
      
      const remainingText = this.removeFoundContent(text, regexResults.assignments);
      console.log('📄 Remaining text length:', remainingText.length, 'characters');
      
      let aiRemainderResults = { assignments: [] };
      if (remainingText.length > 100 && this.aiService.apiKey) {
        aiRemainderResults = await this.parseRemainingWithAI(remainingText, regexResults);
        console.log('🤖 AI found', aiRemainderResults.assignments.length, 'additional assignments in remainder');
      }
      
      // STAGE 3: AI validates and enhances regex results
      onProgress?.({ stage: 'ai-validate', message: 'AI validating and enhancing regex results...' });
      
      let enhancedRegexResults = regexResults;
      if (this.aiService.apiKey) {
        enhancedRegexResults = await this.validateAndEnhanceWithAI(
          text, 
          regexResults, 
          course, 
          detectedType
        );
        // FIXED: Add safety check for validatedAssignments
        console.log('✨ AI enhanced', enhancedRegexResults.validatedAssignments?.length || 0, 'assignments');
      }
      
      // STAGE 4: Merge AI findings with enhanced regex results
      onProgress?.({ stage: 'merging', message: 'Consolidating all results...' });
      
      const finalResults = await this.consolidateResults(
        enhancedRegexResults,
        aiRemainderResults,
        text
      );
      
      console.log('✅ Final result:', finalResults.assignments.length, 'total assignments');
      
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

  // STAGE 1: Parse with regex
  async parseWithRegex(text, course, userCourses, documentType = 'mixed') {
    // Select the appropriate parser based on document type
    const parser = this.documentParsers[documentType] || this.documentParsers['mixed'];
    
    console.log(`📄 Using ${documentType} parser:`, parser.constructor.name);
    
    let results;
    if (documentType === 'mixed' || !this.documentParsers[documentType]) {
      // Generic parser uses different signature
      results = parser.parse(text);
    } else {
      // Document-specific parsers expect course as second parameter
      results = parser.parse(text, course);
    }
    
    // Ensure all assignments have required fields
    const assignments = (results.assignments || []).map((assignment, idx) => ({
      ...assignment,
      id: assignment.id || `regex_${Date.now()}_${idx}`,
      course: assignment.course || course || 'unknown',
      source: `regex-${documentType}`,
      extractedFrom: assignment.extractedFrom || null // Track source text for removal
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

  // STAGE 2: Enhanced content removal for Canvas formatting
  removeFoundContent(originalText, foundAssignments) {
    let remainingText = originalText;
    
    // Sort assignments by their position in text (if tracked)
    const sortedAssignments = [...foundAssignments].sort((a, b) => {
      const posA = a.extractedFrom ? originalText.indexOf(a.extractedFrom) : -1;
      const posB = b.extractedFrom ? originalText.indexOf(b.extractedFrom) : -1;
      return posB - posA; // Reverse order to avoid position shifts
    });
    
    // Remove found content more carefully for Canvas content
    sortedAssignments.forEach(assignment => {
      if (assignment.extractedFrom) {
        // For Canvas content, be more conservative about removal
        // Only remove if it's a clear, standalone line
        const lines = remainingText.split('\n');
        const updatedLines = lines.filter(line => {
          const trimmedLine = line.trim();
          const extractedTrimmed = assignment.extractedFrom.trim();
          
          // Exact match or contains the full extracted text
          return !(trimmedLine === extractedTrimmed || 
                  (trimmedLine.includes(extractedTrimmed) && 
                   trimmedLine.length < extractedTrimmed.length * 1.5));
        });
        
        remainingText = updatedLines.join('\n');
      }
    });
    
    return remainingText;
  }

  // Parse remaining text with AI (after regex extraction)
  async parseRemainingWithAI(remainingText, regexResults) {
    try {
      const context = {
        existingAssignments: regexResults.assignments.map(a => ({
          text: a.text,
          date: a.date,
          type: a.type
        })),
        documentType: regexResults.documentType,
        course: regexResults.assignments[0]?.course || 'unknown'
      };

      const aiRemainderResults = await this.aiService.parseRemainder(remainingText, context);
      
      return {
        assignments: (aiRemainderResults.assignments || []).map((assignment, idx) => ({
          ...assignment,
          id: assignment.id || `ai_remainder_${Date.now()}_${idx}`,
          source: 'ai-remainder',
          aiEnhanced: true
        }))
      };
    } catch (error) {
      console.warn('⚠️ AI remainder parsing failed:', error.message);
      return { assignments: [] };
    }
  }

  // STAGE 3: AI validates and enhances regex results
  async validateAndEnhanceWithAI(text, regexResults, course, documentType) {
    try {
      const validationRequest = {
        originalText: text.substring(0, 3000), // Limit for API
        regexAssignments: regexResults.assignments,
        documentType: documentType,
        course: course
      };

      const aiValidation = await this.aiService.validateAssignments(validationRequest);
      
      return {
        ...regexResults,
        validatedAssignments: aiValidation.validatedAssignments || regexResults.assignments,
        confidence: aiValidation.confidence || regexResults.confidence,
        aiInsights: aiValidation.insights || []
      };
    } catch (error) {
      console.warn('⚠️ AI validation failed:', error.message);
      return regexResults; // Return original results if AI fails
    }
  }

  // STAGE 4: Consolidate results from all sources
  async consolidateResults(enhancedRegexResults, aiRemainderResults, originalText) {
    // Start with validated regex results or original if validation failed
    const baseAssignments = enhancedRegexResults.validatedAssignments || enhancedRegexResults.assignments || [];
    
    // Add AI-found assignments from remainder
    const additionalAssignments = aiRemainderResults.assignments || [];
    
    // Combine all assignments
    const allAssignments = [...baseAssignments, ...additionalAssignments];
    
    // Deduplicate assignments
    const deduplicatedAssignments = this.simpleDeduplication(allAssignments);
    
    // Calculate final confidence
    const finalConfidence = this.calculateFinalConfidence(deduplicatedAssignments);
    
    return {
      assignments: deduplicatedAssignments,
      modules: enhancedRegexResults.modules || [],
      events: enhancedRegexResults.events || [],
      metadata: {
        method: 'sequential-enhanced',
        confidence: finalConfidence,
        summary: `Found ${deduplicatedAssignments.length} assignments (${baseAssignments.length} from regex, ${additionalAssignments.length} from AI remainder)`,
        insights: enhancedRegexResults.aiInsights || [],
        stages: {
          regex: baseAssignments.length,
          aiRemainder: additionalAssignments.length,
          duplicatesRemoved: allAssignments.length - deduplicatedAssignments.length,
          aiFound: additionalAssignments.length > 0 ? 'found-additional' : 'none-found',
          aiValidation: enhancedRegexResults.validatedAssignments ? 'completed' : 'skipped',
          consolidation: 'completed'
        }
      }
    };
  }

  // Simple deduplication for fallback
  simpleDeduplication(assignments) {
    const uniqueMap = new Map();
    
    assignments.forEach(assignment => {
      const key = `${assignment.text?.toLowerCase().substring(0, 30)}_${assignment.date || 'nodate'}`;
      
      if (!uniqueMap.has(key) || assignment.aiEnhanced) {
        // Prefer AI-enhanced versions
        uniqueMap.set(key, assignment);
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  // Calculate confidence based on validation results
  calculateFinalConfidence(assignments) {
    if (!assignments || assignments.length === 0) return 0.1;
    
    let confidence = 0.6; // Base confidence for sequential method
    
    // Boost for validated assignments
    const validated = assignments.filter(a => a.aiEnhanced || a.source?.includes('enhanced')).length;
    confidence += (validated / assignments.length) * 0.2;
    
    // Boost for assignments with dates
    const withDates = assignments.filter(a => a.date).length;
    confidence += (withDates / assignments.length) * 0.1;
    
    // Boost for reasonable count
    if (assignments.length >= 5 && assignments.length <= 100) {
      confidence += 0.1;
    }
    
    return Math.min(0.95, confidence);
  }

  // Enhanced confidence calculation for Canvas content
  calculateConfidence(results) {
    if (!results.assignments || results.assignments.length === 0) return 0.1;
    
    let confidence = 0.5;
    
    const withDates = results.assignments.filter(a => a.date).length;
    confidence += (withDates / results.assignments.length) * 0.3;
    
    const withPoints = results.assignments.filter(a => a.points).length;
    confidence += (withPoints / results.assignments.length) * 0.1;
    
    // Canvas-specific confidence boost
    const canvasIndicators = results.assignments.filter(a => 
      a.text && (
        a.text.includes('Dropbox') ||
        a.text.includes('Quiz') ||
        a.text.includes('HESI') ||
        a.text.includes('Sherpath')
      )
    ).length;
    
    if (canvasIndicators > 0) {
      confidence += 0.1;
    }
    
    if (results.assignments.length >= 3 && results.assignments.length <= 50) {
      confidence += 0.1;
    }
    
    return Math.min(0.95, confidence);
  }
}

export default StudioraDualParser;