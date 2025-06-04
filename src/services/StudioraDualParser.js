// src/services/StudioraDualParser.js
import { StudiorAIService } from './StudiorAIService.js';
import { RegexDocumentParser } from './RegexDocumentParser.js';
import { 
  CanvasModulesParser, 
  CanvasAssignmentsParser, 
  SyllabusParser, 
  ScheduleParser 
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
      'schedule': new ScheduleParser()
    };
  }

  async parse(text, options = {}, onProgress = null) {
    const { course, documentType = 'mixed', userCourses = [] } = options;
    
    console.log('🎓 Studiora: Starting sequential parsing...');
    console.log('📄 Document type:', documentType);
    console.log('📚 Course:', course);
    
    onProgress?.({ stage: 'starting', message: `Initializing ${documentType} parser...` });
    
    try {
      // Phase 1: Document-specific regex parsing
      onProgress?.({ stage: 'regex', message: 'Scanning document with specialized patterns...' });
      
      const regexResults = await this.parseWithDocumentSpecificParser(text, course, documentType);
      
      console.log('📊 Regex found:', regexResults.assignments.length, 'assignments');
      onProgress?.({ 
        stage: 'regex-complete', 
        message: `Found ${regexResults.assignments.length} assignments`,
        results: regexResults 
      });
      
      // Phase 2: AI processes remaining text + validates
      if (options.useAI !== false && this.aiService.apiKey) {
        onProgress?.({ stage: 'ai', message: 'AI analyzing remaining text and validating results...' });
        
        // Remove found content from text
        const remainingText = this.removeFoundContent(text, regexResults.assignments);
        
        // AI analyzes remaining text AND validates regex results
        const aiEnhanced = await this.aiSequentialEnhancement(
          remainingText, 
          regexResults, 
          text,
          course,
          documentType
        );
        
        console.log('🤖 AI found', aiEnhanced.additionalAssignments.length, 'additional assignments');
        console.log('✅ AI validated', aiEnhanced.validatedAssignments.length, 'assignments');
        
        // Phase 3: Compile final results
        onProgress?.({ stage: 'compiling', message: 'Compiling final results...' });
        
        const finalResults = this.compileResults(regexResults, aiEnhanced);
        
        onProgress?.({ 
          stage: 'complete', 
          message: 'Parsing complete!',
          results: finalResults
        });
        
        return finalResults;
      } else {
        // No AI, just return regex results
        onProgress?.({ 
          stage: 'complete', 
          message: 'Parsing complete!',
          results: regexResults
        });
        
        return regexResults;
      }
      
    } catch (error) {
      console.error('❌ Studiora parsing failed:', error);
      onProgress?.({ stage: 'error', message: error.message, error });
      throw error;
    }
  }

  async parseWithDocumentSpecificParser(text, course, documentType) {
    let results;
    
    // Use document-specific parser if available
    if (documentType !== 'mixed' && this.documentParsers[documentType]) {
      const parser = this.documentParsers[documentType];
      results = parser.parse(text, course);
      
      // Ensure all assignments have proper structure
      results.assignments = (results.assignments || []).map((assignment, idx) => ({
        ...assignment,
        id: assignment.id || `${documentType}_${Date.now()}_${idx}`,
        course: assignment.course || course || 'unknown',
        source: `${documentType}-parser`,
        extractedFrom: assignment.extractedFrom || assignment.text
      }));
    } else {
      // Use general regex parser for mixed content
      const regexResults = this.regexParser.parse(text);
      results = {
        assignments: (regexResults.assignments || []).map((assignment, idx) => ({
          ...assignment,
          id: assignment.id || `regex_${Date.now()}_${idx}`,
          course: assignment.course || course || 'unknown',
          source: 'regex-general'
        })),
        modules: regexResults.modules || [],
        events: regexResults.events || []
      };
    }
    
    return {
      ...results,
      confidence: this.calculateConfidence(results),
      source: documentType !== 'mixed' ? `${documentType}-parser` : 'regex-general',
      timestamp: Date.now()
    };
  }

  removeFoundContent(originalText, foundAssignments) {
    let remainingText = originalText;
    const placeholders = [];
    
    // Sort assignments by their position in text (if we can determine it)
    foundAssignments.forEach((assignment, index) => {
      // Try to find the assignment text in the original
      const searchText = assignment.extractedFrom || assignment.text;
      const position = remainingText.indexOf(searchText);
      
      if (position !== -1) {
        // Replace with placeholder to avoid re-parsing
        const placeholder = `[PARSED_${index}]`;
        remainingText = remainingText.substring(0, position) + 
                       placeholder + 
                       remainingText.substring(position + searchText.length);
        
        placeholders.push({
          placeholder,
          assignment,
          originalText: searchText
        });
      }
    });
    
    console.log(`📄 Removed ${placeholders.length} found assignments from text`);
    console.log(`📄 Remaining text length: ${remainingText.length} (was ${originalText.length})`);
    
    return remainingText;
  }

  async aiSequentialEnhancement(remainingText, regexResults, originalText, course, documentType) {
    try {
      const prompt = `You are Studiora's AI validator and enhancer analyzing a ${documentType} from a nursing course. The regex parser has already extracted assignments but may have missed dates or other important details.

FULL ORIGINAL DOCUMENT:
${originalText}

REGEX PARSER FOUND ${regexResults.assignments.length} ASSIGNMENTS:
${JSON.stringify(regexResults.assignments, null, 2)}

REMAINING UNPARSED TEXT:
${remainingText}

YOUR CRITICAL TASKS:

1. **VALIDATE EVERY SINGLE ASSIGNMENT** (MANDATORY)
   - You MUST provide validation for ALL ${regexResults.assignments.length} assignments found by regex
   - For each assignment, determine if it's valid and if it needs corrections
   - Do not skip any assignments - validate all of them

2. **DATE VALIDATION AND FIXING** (CRITICAL)
   - Many assignments are missing dates ("No due date")
   - Search the original document for date patterns like:
     * "August 1:", "Thursday August 7", "May 15"
     * Week numbers that can be converted to dates
     * Relative dates ("next Monday", "following week")
   - Match assignments to their correct dates by context
   - Convert all dates to YYYY-MM-DD format
   - Use Spring 2025 semester (May 5 - August 10, 2025)

3. **FIND MISSED ASSIGNMENTS**
   - Look for implicit assignments: "prepare for", "review", "study"
   - Clinical prep requirements
   - Pre/post activity work
   - NCLEX/HESI preparation that wasn't caught

4. **VALIDATE AND IMPROVE**
   - Check if assignment types make sense
   - Verify point values match assignment importance
   - Flag duplicates or near-duplicates
   - Ensure hour estimates are reasonable

5. **CONTEXT MATTERS**
   - If you see "Week 3: May 19-25" then assignments in that section are likely due that week
   - "*August 1:**" means that date applies to what follows
   - Time indicators (2:00PM) suggest specific scheduling

Think like a nursing student who needs accurate dates for their planner. Be aggressive about finding and fixing dates - it's better to make an educated guess based on context than to leave "No due date".

RESPOND WITH ONLY VALID JSON:
{
  "additionalAssignments": [
    {
      "text": "Assignment description",
      "date": "YYYY-MM-DD",
      "type": "reading|quiz|exam|assignment|lab|discussion|clinical|prep",
      "hours": 1.5,
      "course": "${course}",
      "confidence": 0.8,
      "extractionReason": "Why this was missed by regex"
    }
  ],
  "validatedAssignments": [
    {
      "originalId": "YOU MUST INCLUDE AN ENTRY FOR EACH ASSIGNMENT ID",
      "isValid": true or false,
      "issues": ["list any issues found, empty array if none"],
      "corrections": {
        "date": "YYYY-MM-DD if date was missing or wrong",
        "type": "corrected type if needed",
        "hours": "corrected hours if needed"
      }
    }
  ],
  "invalidAssignments": [
    {
      "originalId": "assignment id",
      "reason": "Why this should be removed (duplicate, not an assignment, etc)",
      "suggestion": "merge with X or remove"
    }
  ],
  "improvements": [
    {
      "originalId": "assignment id",
      "field": "date|hours|type|text",
      "currentValue": "current value",
      "suggestedValue": "improved value",
      "reason": "Why this improvement"
    }
  ],
  "summary": {
    "additionalFound": 0,
    "validated": 0,
    "invalid": 0,
    "improved": 0,
    "datesFixed": 0
  }
}`;

      const result = await this.aiService.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'sequential-enhancement',
        maxTokens: 4000
      });

      // Ensure we have validation for all assignments
      const validatedIds = new Set(result.validatedAssignments.map(v => v.originalId));
      const missingValidations = regexResults.assignments.filter(a => !validatedIds.has(a.id));
      
      if (missingValidations.length > 0) {
        console.warn(`⚠️ AI didn't validate ${missingValidations.length} assignments. Adding default validation.`);
        missingValidations.forEach(assignment => {
          result.validatedAssignments.push({
            originalId: assignment.id,
            isValid: true,
            issues: ['Not validated by AI'],
            corrections: {}
          });
        });
      }

      return {
        additionalAssignments: result.additionalAssignments || [],
        validatedAssignments: result.validatedAssignments || [],
        invalidAssignments: result.invalidAssignments || [],
        improvements: result.improvements || [],
        summary: result.summary || {}
      };
      
    } catch (error) {
      console.warn('⚠️ AI enhancement failed:', error.message);
      return {
        additionalAssignments: [],
        validatedAssignments: [],
        invalidAssignments: [],
        improvements: [],
        summary: { error: error.message }
      };
    }
  }

  compileResults(regexResults, aiEnhanced) {
    // Start with regex results
    let finalAssignments = [...regexResults.assignments];
    
    // Log validation details
    console.log('🔍 AI Validation Analysis:');
    console.log(`  Total regex assignments: ${regexResults.assignments.length}`);
    console.log(`  AI processed validations: ${aiEnhanced.validatedAssignments.length}`);
    
    // Create validation map
    const validationMap = new Map();
    aiEnhanced.validatedAssignments.forEach(v => {
      validationMap.set(v.originalId, v);
    });
    
    // Analyze validation coverage
    const validatedIds = new Set(aiEnhanced.validatedAssignments.map(v => v.originalId));
    const unvalidatedAssignments = regexResults.assignments.filter(a => !validatedIds.has(a.id));
    
    console.log(`  ✅ Validated: ${validatedIds.size}`);
    console.log(`  ❌ Not validated by AI: ${unvalidatedAssignments.length}`);
    
    // Show why assignments weren't validated
    if (unvalidatedAssignments.length > 0) {
      console.log('\n  🔍 WHY THESE WEREN\'T VALIDATED:');
      console.log('  (AI may have skipped these due to token limits, complexity, or they appeared after cutoff)');
      unvalidatedAssignments.forEach((a, idx) => {
        console.log(`    ${idx + 1}. "${a.text.substring(0, 60)}${a.text.length > 60 ? '...' : ''}" `);
        console.log(`       - Date: ${a.date || 'No date'}`);
        console.log(`       - Type: ${a.type}`);
        console.log(`       - ID: ${a.id}`);
      });
    }
    
    // Show validation decisions
    console.log('\n  📋 AI VALIDATION DECISIONS:');
    let validCount = 0, invalidCount = 0, issuesCount = 0;
    
    aiEnhanced.validatedAssignments.forEach(validation => {
      const assignment = regexResults.assignments.find(a => a.id === validation.originalId);
      if (!assignment) return;
      
      if (validation.isValid) {
        validCount++;
        if (validation.issues && validation.issues.length > 0) {
          issuesCount++;
          console.log(`    ⚠️ Valid with issues: "${assignment.text.substring(0, 50)}..."`);
          console.log(`       Issues: ${validation.issues.join(', ')}`);
        }
      } else {
        invalidCount++;
        console.log(`    ❌ Invalid: "${assignment.text.substring(0, 50)}..."`);
        console.log(`       Issues: ${validation.issues?.join(', ') || 'No specific issues noted'}`);
      }
    });
    
    console.log(`\n  Summary: ${validCount} valid (${issuesCount} with issues), ${invalidCount} invalid`);
    
    // Remove invalid assignments identified by AI
    const invalidIds = new Set(aiEnhanced.invalidAssignments.map(inv => inv.originalId));
    finalAssignments = finalAssignments.filter(a => !invalidIds.has(a.id));
    
    // Apply AI improvements
    if (aiEnhanced.improvements.length > 0) {
      console.log(`\n  🔧 AI IMPROVEMENTS (${aiEnhanced.improvements.length}):`);
      aiEnhanced.improvements.slice(0, 5).forEach(improvement => {
        const assignment = finalAssignments.find(a => a.id === improvement.originalId);
        if (assignment) {
          console.log(`    - "${assignment.text.substring(0, 40)}..."`);
          console.log(`      ${improvement.field}: "${improvement.currentValue}" → "${improvement.suggestedValue}"`);
          console.log(`      Reason: ${improvement.reason}`);
          assignment[improvement.field] = improvement.suggestedValue;
          assignment.aiImproved = true;
        }
      });
      if (aiEnhanced.improvements.length > 5) {
        console.log(`    ... and ${aiEnhanced.improvements.length - 5} more improvements`);
      }
    }
    
    // Apply corrections from validated assignments
    aiEnhanced.validatedAssignments.forEach(validation => {
      if (validation.corrections && Object.keys(validation.corrections).length > 0) {
        const assignment = finalAssignments.find(a => a.id === validation.originalId);
        if (assignment) {
          Object.entries(validation.corrections).forEach(([field, value]) => {
            assignment[field] = value;
            assignment.aiCorrected = true;
          });
        }
      }
    });
    
    // Mark validated assignments
    finalAssignments = finalAssignments.map(assignment => ({
      ...assignment,
      aiValidated: validatedIds.has(assignment.id),
      aiValidationStatus: validatedIds.has(assignment.id) ? 'validated' : 'not-processed',
      aiValidationIssues: validationMap.get(assignment.id)?.issues || []
    }));
    
    // Add AI-found additional assignments
    const additionalWithIds = aiEnhanced.additionalAssignments.map((assignment, idx) => ({
      ...assignment,
      id: `ai_additional_${Date.now()}_${idx}`,
      source: 'ai-sequential',
      aiFound: true,
      aiValidated: true,
      aiValidationStatus: 'ai-found'
    }));
    
    if (additionalWithIds.length > 0) {
      console.log(`\n  🆕 AI FOUND ADDITIONAL (${additionalWithIds.length}):`);
      additionalWithIds.forEach(a => {
        console.log(`    - "${a.text}"`);
        console.log(`      Reason: ${a.extractionReason}`);
      });
    }
    
    finalAssignments.push(...additionalWithIds);
    
    // Sort by date
    finalAssignments.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });
    
    const metadata = {
      method: 'sequential-document-specific',
      documentType: regexResults.source,
      confidence: this.calculateFinalConfidence(regexResults, aiEnhanced, finalAssignments),
      regexFound: regexResults.assignments.length,
      aiProcessed: aiEnhanced.validatedAssignments.length,
      aiNotProcessed: unvalidatedAssignments.length,
      aiValidated: validCount,
      aiInvalidated: invalidCount,
      aiImproved: aiEnhanced.improvements.length,
      aiCorrected: aiEnhanced.validatedAssignments.filter(v => v.corrections && Object.keys(v.corrections).length > 0).length,
      aiAdditional: additionalWithIds.length,
      totalFinal: finalAssignments.length,
      summary: `Sequential: ${regexResults.assignments.length} regex → AI processed ${aiEnhanced.validatedAssignments.length} (skipped ${unvalidatedAssignments.length}) → ${invalidIds.size} removed → ${additionalWithIds.length} added → ${finalAssignments.length} final`,
      validationGaps: unvalidatedAssignments.map(a => ({
        id: a.id,
        text: a.text,
        reason: 'Not processed by AI - likely due to token limits or appeared after AI cutoff'
      }))
    };
    
    console.log(`\n📊 Final result: ${metadata.totalFinal} assignments`);
    
    return {
      assignments: finalAssignments,
      modules: regexResults.modules || [],
      events: regexResults.events || [],
      metadata,
      aiEnhancement: aiEnhanced,
      rawResults: {
        regex: regexResults
      }
    };
  }

  calculateConfidence(results) {
    if (!results.assignments || results.assignments.length === 0) return 0.1;
    
    let confidence = 0.5;
    
    const withDates = results.assignments.filter(a => a.date).length;
    confidence += (withDates / results.assignments.length) * 0.3;
    
    const withTypes = results.assignments.filter(a => a.type && a.type !== 'assignment').length;
    confidence += (withTypes / results.assignments.length) * 0.1;
    
    if (results.assignments.length >= 5 && results.assignments.length <= 100) {
      confidence += 0.1;
    }
    
    return Math.min(0.95, confidence);
  }

  calculateFinalConfidence(regexResults, aiEnhanced, finalAssignments) {
    const baseConfidence = regexResults.confidence || 0.5;
    
    // Boost for AI validation
    const validationRate = aiEnhanced.validatedAssignments.filter(v => v.isValid).length / 
                          Math.max(1, regexResults.assignments.length);
    const validationBoost = validationRate * 0.2;
    
    // Small boost for finding additional assignments
    const additionalBoost = Math.min(0.1, aiEnhanced.additionalAssignments.length * 0.02);
    
    // Penalty for invalid assignments
    const invalidPenalty = Math.min(0.1, aiEnhanced.invalidAssignments.length * 0.02);
    
    return Math.min(0.95, baseConfidence + validationBoost + additionalBoost - invalidPenalty);
  }
}

export default StudioraDualParser;