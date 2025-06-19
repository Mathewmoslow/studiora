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
import { ScheduleParser } from './ScheduleParser.js';

export class StudioraDualParser {
  constructor(apiKey, options = {}) {
    this.regexParser = new RegexDocumentParser();
    this.aiService = new StudiorAIService(apiKey, options);
    
    // Initialize document-specific parsers
    this.documentParsers = {
      'canvas-modules': new CanvasModulesParser(),
      'canvas-assignments': new CanvasAssignmentsParser(),
      'syllabus': new SyllabusParser(),
      'schedule': new ScheduleParser(), // Use enhanced version
      'mixed': this.regexParser
    };
  }

  async parse(text, options = {}, onProgress = null) {
    const { course, documentType = 'mixed', userCourses = [] } = options;
    
    // Detect domain and build configuration
    
    console.log('🎓 Studiora: Starting sequential enhancement parsing...');
    console.log('📄 Document type:', documentType);
    console.log('📚 Course:', course);
    
    onProgress?.({ 
      stage: 'starting', 
    });
    
    try {
      // STAGE 1: Regex parsing with domain configuration
      onProgress?.({ stage: 'regex', message: 'Regex scanning for assignments...' });
      
      const regexResults = await this.parseWithRegex(text, course, config, documentType);
      
      console.log('📊 Regex found:', regexResults.assignments.length, 'assignments');
      onProgress?.({ 
        stage: 'regex-complete', 
        message: `Regex found ${regexResults.assignments.length} assignments`,
        results: regexResults 
      });
      
      // STAGE 2: AI parses remainder
      onProgress?.({ stage: 'ai-remainder', message: 'AI analyzing remaining text...' });
      
      const remainingText = this.removeFoundContent(text, regexResults.assignments);
      console.log('📄 Remaining text length:', remainingText.length, 'characters');
      
      let aiRemainderResults = { assignments: [] };
      if (remainingText.length > 100 && this.aiService.apiKey) {
        aiRemainderResults = await this.parseRemainingWithAI(remainingText, regexResults);
        console.log('🤖 AI found', aiRemainderResults.assignments.length, 'additional assignments');
      }
      
      // STAGE 3: AI validation
      onProgress?.({ stage: 'ai-validate', message: 'AI validating and enhancing results...' });
      
      let enhancedRegexResults = regexResults;
      if (this.aiService.apiKey) {
        enhancedRegexResults = await this.validateAndEnhanceWithAI(
          text, 
          regexResults, 
          course, 
          documentType
        );
        console.log('✨ AI enhanced', enhancedRegexResults.validatedAssignments?.length || 0, 'assignments');
      }
      
      // STAGE 4: Consolidation
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

      documentType: options.documentType,
      defaultYear: options.defaultYear || new Date().getFullYear(),
      semesterStart: options.semesterStart,
      semesterEnd: options.semesterEnd,
      minConfidenceForAI: options.minConfidenceForAI || 0.7,
      ...options.customConfig
    });
  }

  async parseWithRegex(text, course, config, documentType = 'mixed') {
    // Create parser with configuration
    const parser = this.documentParsers[documentType] || this.documentParsers['mixed'];
    
    // If it's the enhanced parser, pass config
    if (parser instanceof ScheduleParser) {
      parser.config = config;
    }
    
    console.log(`📄 Using ${documentType} parser:`, parser.constructor.name);
    
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
      extractedFrom: assignment.extractedFrom || null,
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

  async parseRemainingWithAI(remainingText, regexResults) {
    return this.aiService.parseRemainingWithAI(remainingText, regexResults);
  }

  async validateAndEnhanceWithAI(originalText, regexResults, course, documentType) {
    return this.aiService.validateAndEnhanceWithAI(originalText, regexResults, course, documentType);
  }

  async consolidateResults(enhancedRegexResults, aiRemainderResults, originalText) {
    const allAssignments = [
      ...(enhancedRegexResults.assignments || []),
      ...(aiRemainderResults.assignments || [])
    ];
    
    if (this.aiService.apiKey && allAssignments.length > 0) {
      const consolidated = await this.aiService.consolidateResults(
        enhancedRegexResults, 
        aiRemainderResults, 
        originalText
      );
      
      return this.formatFinalResults(
        consolidated.assignments,
        enhancedRegexResults,
        aiRemainderResults,
        consolidated.metadata?.consolidation?.summary
      );
    }
    
    const uniqueAssignments = this.simpleDeduplication(allAssignments);
    
    return this.formatFinalResults(
      uniqueAssignments,
      enhancedRegexResults,
      aiRemainderResults,
      'Simple deduplication used'
    );
  }

  formatFinalResults(assignments, enhancedRegexResults, aiRemainderResults, summary) {
    return {
      assignments: assignments,
      modules: enhancedRegexResults.modules || [],
      events: enhancedRegexResults.events || [],
      metadata: {
        method: 'sequential-enhancement',
        domain: enhancedRegexResults.domain,
        domainName: enhancedRegexResults.domainName,
        confidence: this.calculateFinalConfidence(assignments),
        regexFound: enhancedRegexResults.assignments?.length || 0,
        aiFoundInRemainder: aiRemainderResults.assignments?.length || 0,
        invalidatedByAI: enhancedRegexResults.invalidCount || 0,
        totalFinal: assignments.length,
        summary: summary || `Sequential: ${assignments.length} final assignments`,
        stages: {
          regex: 'completed',
          aiRemainder: aiRemainderResults.assignments?.length > 0 ? 'found-additional' : 'none-found',
          aiValidation: enhancedRegexResults.validatedAssignments ? 'completed' : 'skipped',
          consolidation: 'completed'
        }
      }
    };
  }

  simpleDeduplication(assignments) {
    const uniqueMap = new Map();
    
    assignments.forEach(assignment => {
      const key = `${assignment.text?.toLowerCase().substring(0, 30)}_${assignment.date || 'nodate'}`;
      
      if (!uniqueMap.has(key) || assignment.aiEnhanced) {
        uniqueMap.set(key, assignment);
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  calculateFinalConfidence(assignments) {
    if (!assignments || assignments.length === 0) return 0.1;
    
    let confidence = 0.6;
    
    const validated = assignments.filter(a => a.aiEnhanced || a.source?.includes('enhanced')).length;
    confidence += (validated / assignments.length) * 0.2;
    
    const withDates = assignments.filter(a => a.date).length;
    confidence += (withDates / assignments.length) * 0.1;
    
    if (assignments.length >= 5 && assignments.length <= 100) {
      confidence += 0.1;
    }
    
    return Math.min(0.95, confidence);
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
  /* ===== COMMENTED OUT DUAL PARSER CODE =====
  // Original dual parser implementation preserved for reference
  
  async parseWithDualMethod(text, options = {}, onProgress = null) {
    const { course, documentType = 'mixed', userCourses = [] } = options;
    
    console.log('🎓 Studiora: Starting dual independent parsing...');
    
    try {
      // Both parsers work independently on full text
      const [regexResults, aiResults] = await Promise.all([
        this.parseWithRegex(text, course, userCourses),
        this.parseWithAI(text, course, documentType)
      ]);
      
      console.log('📊 Regex found:', regexResults.assignments.length);
      console.log('🤖 AI found:', aiResults.assignments.length);
      
      // AI reconciles the differences
      const reconciled = await this.reconcileWithAI(regexResults, aiResults, text);
      
      return reconciled;
      
    } catch (error) {
      console.error('❌ Dual parsing failed:', error);
      throw error;
    }
  }
  
  async parseWithAI(text, course, documentType) {
    try {
      const aiResults = await this.aiService.parseIndependently(text, documentType, {
        course,
        onProgress: (update) => console.log('🤖 AI:', update.message)
      });
      
      return {
        assignments: (aiResults.assignments || []).map((assignment, idx) => ({
          ...assignment,
          id: assignment.id || `ai_${Date.now()}_${idx}`,
          course: assignment.course || course || 'unknown',
          source: 'ai-independent'
        })),
        modules: aiResults.modules || [],
        events: aiResults.events || [],
        confidence: aiResults.overallConfidence || 0.7,
        source: 'ai-independent'
      };
    } catch (error) {
      console.warn('⚠️ AI parsing failed:', error.message);
      return { assignments: [], modules: [], events: [], confidence: 0 };
    }
  }
  
  async reconcileWithAI(regexResults, aiResults, originalText) {
    try {
      const reconciliationData = {
        originalText: originalText.substring(0, 1000),
        regexResults,
        aiResults
      };
      
      const reconciled = await this.aiService.reconcileResults(reconciliationData, {
        onProgress: (update) => console.log('🔄 Reconciliation:', update.message)
      });
      
      // Build final results from reconciliation
      const finalAssignments = [
        ...reconciled.matches.map(m => m.resolved),
        ...reconciled.regexUnique.map(r => r.assignment),
        ...reconciled.aiUnique.map(a => a.assignment)
      ];
      
      return {
        assignments: finalAssignments,
        modules: [...(regexResults.modules || []), ...(aiResults.modules || [])],
        events: [...(regexResults.events || []), ...(aiResults.events || [])],
        metadata: {
          method: 'dual-reconciled',
          confidence: reconciled.finalConfidence,
          summary: reconciled.reconciliationSummary
        }
      };
      
    } catch (error) {
      console.warn('⚠️ Reconciliation failed:', error.message);
      return this.simpleMerge(regexResults, aiResults);
    }
  }
  
  simpleMerge(regexResults, aiResults) {
    const allAssignments = [
      ...regexResults.assignments,
      ...aiResults.assignments
    ];
    
    return {
      assignments: this.simpleDeduplication(allAssignments),
      modules: [...regexResults.modules, ...aiResults.modules],
      events: [...regexResults.events, ...aiResults.events],
      metadata: {
        method: 'simple-merge',
        confidence: (regexResults.confidence + aiResults.confidence) / 2
      }
    };
  }
  ===== END COMMENTED DUAL PARSER CODE ===== */

export default StudioraDualParser;
