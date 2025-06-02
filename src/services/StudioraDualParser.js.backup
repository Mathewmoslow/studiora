// src/services/StudioraDualParser.js
// Studiora's Elegant Dual Parser - Independent Parsing + Smart Reconciliation

import { RegexDocumentParser } from './RegexDocumentParser';
import { StudiorAIService } from './StudiorAIService';

export class StudioraDualParser {
  constructor(aiApiKey, options = {}) {
    this.regexParser = new RegexDocumentParser();
    this.aiService = new StudiorAIService(aiApiKey, options);
    this.parsingId = null;
  }

  async parse(text, template = 'auto', onProgress = null) {
    this.parsingId = `studiora_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🎓 Studiora: Starting elegant dual parsing...');
    onProgress?.({ stage: 'starting', message: 'Initializing Studiora parsers...' });
    
    try {
      // PHASE 1: Independent parsing (parallel)
      onProgress?.({ stage: 'parsing', message: 'Running independent parsers...' });
      
      const [regexResult, aiResult] = await Promise.allSettled([
        this.parseWithRegex(text, template, onProgress),
        this.parseWithAI(text, template, onProgress)
      ]);

      const regexResults = regexResult.status === 'fulfilled' ? regexResult.value : null;
      const aiResults = aiResult.status === 'fulfilled' ? aiResult.value : null;

      // Log intermediate results
      console.log('📊 Regex Results:', regexResults?.assignments?.length || 0, 'assignments');
      console.log('🤖 AI Results:', aiResults?.assignments?.length || 0, 'assignments');

      // PHASE 2: Intelligent reconciliation
      onProgress?.({ stage: 'reconciling', message: 'Reconciling results with AI...' });
      
      const finalResults = await this.reconcileResults(text, regexResults, aiResults, onProgress);
      
      onProgress?.({ stage: 'complete', message: 'Parsing complete!', results: finalResults });
      
      return finalResults;

    } catch (error) {
      console.error('❌ Studiora parsing failed:', error);
      onProgress?.({ stage: 'error', message: error.message, error });
      throw error;
    }
  }

  async parseWithRegex(text, template, onProgress) {
    console.log('📊 Studiora Regex: Parsing independently...');
    onProgress?.({ stage: 'regex', message: 'Regex parser analyzing structure...' });
    
    const results = this.regexParser.parse(text, template);
    const confidence = this.calculateRegexConfidence(results, text);
    
    return {
      ...results,
      confidence,
      source: 'studiora-regex',
      timestamp: Date.now(),
      parsingId: this.parsingId
    };
  }

  async parseWithAI(text, template, onProgress) {
    console.log('🤖 Studiora AI: Parsing independently...');
    onProgress?.({ stage: 'ai', message: 'AI parser analyzing content...' });
    
    try {
      const aiResults = await this.aiService.parseIndependently(text, template, {
        onProgress: (aiProgress) => {
          onProgress?.({ 
            stage: 'ai', 
            message: `AI: ${aiProgress.message}`,
            substage: aiProgress.stage 
          });
        }
      });
      
      return {
        ...aiResults,
        source: 'studiora-ai',
        timestamp: Date.now(),
        parsingId: this.parsingId
      };
      
    } catch (error) {
      console.warn('⚠️ Studiora AI parsing failed:', error.message);
      return {
        assignments: [],
        modules: [],
        events: [],
        error: error.message,
        source: 'studiora-ai',
        confidence: 0,
        timestamp: Date.now(),
        parsingId: this.parsingId
      };
    }
  }

  async reconcileResults(originalText, regexResults, aiResults, onProgress) {
    console.log('🔄 Studiora: Reconciling results...');
    
    // Handle failure cases
    if (!regexResults && !aiResults) {
      throw new Error('Both Studiora parsers failed');
    }
    
    if (!regexResults) {
      console.log('📊 Regex failed, using AI results only');
      return this.formatFinalResults(null, aiResults, 'ai-only');
    }
    
    if (!aiResults || aiResults.error) {
      console.log('🤖 AI failed, using regex results only');
      return this.formatFinalResults(regexResults, null, 'regex-only');
    }

    // Both succeeded - perform intelligent reconciliation
    onProgress?.({ stage: 'reconciling', message: 'AI reconciling differences...' });
    
    try {
      const reconciliation = await this.performIntelligentReconciliation(
        originalText, 
        regexResults, 
        aiResults,
        onProgress
      );
      
      return this.formatFinalResults(regexResults, aiResults, 'dual-reconciled', reconciliation);
      
    } catch (reconciliationError) {
      console.warn('⚠️ AI reconciliation failed, using naive merge:', reconciliationError.message);
      const naiveReconciliation = this.performNaiveReconciliation(regexResults, aiResults);
      return this.formatFinalResults(regexResults, aiResults, 'naive-merged', naiveReconciliation);
    }
  }

  async performIntelligentReconciliation(originalText, regexResults, aiResults, onProgress) {
    console.log('🧠 Studiora AI: Performing intelligent reconciliation...');
    
    const reconciliationData = {
      originalText,
      regexResults: {
        assignments: regexResults.assignments,
        confidence: regexResults.confidence,
        modules: regexResults.modules || [],
        events: regexResults.events || []
      },
      aiResults: {
        assignments: aiResults.assignments,
        confidence: aiResults.overallConfidence || aiResults.confidence,
        modules: aiResults.modules || [],
        events: aiResults.events || []
      }
    };

    onProgress?.({ 
      stage: 'reconciling', 
      message: `Reconciling ${regexResults.assignments.length} regex + ${aiResults.assignments.length} AI assignments...` 
    });

    return await this.aiService.reconcileResults(reconciliationData);
  }

  performNaiveReconciliation(regexResults, aiResults) {
    console.log('🔧 Studiora: Performing naive reconciliation fallback...');
    
    // Simple merge with basic deduplication
    const allAssignments = [
      ...regexResults.assignments.map(a => ({ ...a, source: 'regex' })),
      ...aiResults.assignments.map(a => ({ ...a, source: 'ai' }))
    ];
    
    const deduplicatedAssignments = this.deduplicateAssignments(allAssignments);
    
    return {
      matches: [],
      regexUnique: regexResults.assignments,
      aiUnique: aiResults.assignments,
      conflicts: [],
      finalAssignments: deduplicatedAssignments,
      finalConfidence: (regexResults.confidence + (aiResults.overallConfidence || 0)) / 2,
      reconciliationSummary: `Naive merge: ${deduplicatedAssignments.length} total assignments`,
      method: 'naive-fallback'
    };
  }

  formatFinalResults(regexResults, aiResults, method, reconciliation = null) {
    const timestamp = Date.now();
    let finalAssignments, finalModules, finalEvents, metadata;

    switch (method) {
      case 'regex-only':
        finalAssignments = regexResults.assignments.map(a => ({ ...a, source: 'regex-only' }));
        finalModules = regexResults.modules || [];
        finalEvents = regexResults.events || [];
        metadata = {
          method: 'regex-only',
          confidence: regexResults.confidence,
          aiError: aiResults?.error,
          summary: `Regex found ${finalAssignments.length} assignments (AI unavailable)`,
          parsingId: this.parsingId
        };
        break;

      case 'ai-only':
        finalAssignments = aiResults.assignments.map(a => ({ ...a, source: 'ai-only' }));
        finalModules = aiResults.modules || [];
        finalEvents = aiResults.events || [];
        metadata = {
          method: 'ai-only',
          confidence: aiResults.overallConfidence || aiResults.confidence,
          regexError: regexResults?.error,
          summary: `AI found ${finalAssignments.length} assignments (Regex unavailable)`,
          parsingId: this.parsingId
        };
        break;

      case 'dual-reconciled':
        // Build assignments from reconciliation
        finalAssignments = [
          ...(reconciliation.matches || []).map(m => ({
            ...m.resolved,
            source: `reconciled-${m.winnerSource}`,
            confidence: m.confidence,
            reconciliationNote: m.reasoning
          })),
          ...(reconciliation.regexUnique || []).map(r => ({
            ...r.assignment,
            source: 'regex-unique',
            confidence: r.confidence,
            uniqueReason: r.keepReason
          })),
          ...(reconciliation.aiUnique || []).map(a => ({
            ...a.assignment,
            source: 'ai-unique',
            confidence: a.confidence,
            uniqueReason: a.keepReason
          }))
        ];

        finalModules = this.mergeArrays(regexResults.modules, aiResults.modules, 'title');
        finalEvents = this.mergeArrays(regexResults.events, aiResults.events, 'title');

        metadata = {
          method: 'dual-reconciled',
          confidence: reconciliation.finalConfidence,
          regexConfidence: regexResults.confidence,
          aiConfidence: aiResults.overallConfidence || aiResults.confidence,
          summary: reconciliation.reconciliationSummary,
          reconciliationDetails: {
            matches: reconciliation.matches?.length || 0,
            regexUnique: reconciliation.regexUnique?.length || 0,
            aiUnique: reconciliation.aiUnique?.length || 0,
            conflicts: reconciliation.conflicts?.length || 0
          },
          parsingId: this.parsingId
        };
        break;

      case 'naive-merged':
        finalAssignments = reconciliation.finalAssignments;
        finalModules = this.mergeArrays(regexResults.modules, aiResults.modules, 'title');
        finalEvents = this.mergeArrays(regexResults.events, aiResults.events, 'title');
        metadata = {
          method: 'naive-merged',
          confidence: reconciliation.finalConfidence,
          summary: reconciliation.reconciliationSummary,
          parsingId: this.parsingId
        };
        break;
    }

    return {
      assignments: finalAssignments,
      modules: finalModules,
      events: finalEvents,
      learningObjectives: aiResults?.learningObjectives || {},
      studyHints: aiResults?.studyHints || [],
      workloadWarnings: aiResults?.workloadWarnings || [],
      metadata,
      reconciliation,
      rawResults: {
        regex: regexResults,
        ai: aiResults
      },
      timestamp,
      version: '1.0.0',
      appName: 'Studiora'
    };
  }

  calculateRegexConfidence(results, text) {
    let confidence = 0;
    
    // Base confidence from pattern recognition
    const textLength = text.length;
    const assignmentDensity = results.assignments.length / (textLength / 1000);
    confidence += Math.min(0.4, assignmentDensity * 0.05);
    
    // Date extraction success
    const assignmentsWithDates = results.assignments.filter(a => a.date).length;
    if (results.assignments.length > 0) {
      confidence += (assignmentsWithDates / results.assignments.length) * 0.3;
    }
    
    // Structure recognition
    if (results.modules?.length > 0) confidence += 0.2;
    if (text.includes('Module') || text.includes('Week')) confidence += 0.1;
    if (text.includes('Assignment') || text.includes('Quiz')) confidence += 0.1;
    
    // Content type recognition
    if (text.includes('Syllabus') || text.includes('Course')) confidence += 0.1;
    
    // Error penalties
    if (results.errors?.length > 0) {
      confidence -= Math.min(0.3, results.errors.length * 0.05);
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  deduplicateAssignments(assignments) {
    const unique = [];
    
    for (const assignment of assignments) {
      const isDuplicate = unique.some(existing => 
        this.calculateTextSimilarity(existing.text, assignment.text) > 0.8
      );
      
      if (!isDuplicate) {
        unique.push(assignment);
      }
    }
    
    return unique;
  }

  mergeArrays(array1 = [], array2 = [], keyField) {
    const merged = [...array1];
    
    for (const item2 of array2) {
      const exists = merged.some(item1 => 
        item1[keyField] === item2[keyField] ||
        this.calculateTextSimilarity(item1[keyField], item2[keyField]) > 0.7
      );
      
      if (!exists) {
        merged.push({ ...item2, source: 'ai-unique' });
      }
    }
    
    return merged;
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
