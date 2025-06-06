// Enhanced StudiorAIService with improved validation logic
import { StudiorAIService } from './StudiorAIService.js';

export class EnhancedStudiorAIService extends StudiorAIService {
  constructor(apiKey, options = {}) {
    super(apiKey, options);
    this.validationCache = new Map();
  }

  async validateAndEnhanceWithAI(originalText, regexResults, course, documentType) {
    try {
      // Use full context for better validation
      const assignments = regexResults.assignments;
      const contextWindow = Math.min(originalText.length, 15000);
      const textContext = originalText.substring(0, contextWindow);
      
      const prompt = `
You are validating ${assignments.length} assignments extracted by regex from a ${documentType} document.

CRITICAL VALIDATION TASKS:
1. VERIFY each assignment is real (not a header/description)
2. FIX all dates - convert relative to absolute YYYY-MM-DD format
3. COMPLETE missing information using document context
4. STANDARDIZE formatting across all assignments
5. IDENTIFY any false positives for removal

DOCUMENT CONTEXT (first ${contextWindow} chars):
${textContext}

EXTRACTED ASSIGNMENTS TO VALIDATE:
${JSON.stringify(assignments, null, 2)}

IMPORTANT CONTEXT:
- Current date: ${new Date().toISOString().split('T')[0]}
- Spring 2025 semester: May 5 - August 10, 2025
- Course: ${course}
- Document type: ${documentType}

For EACH assignment, determine:
1. Is it a real assignment or misidentified text?
2. What's the correct absolute date?
3. What type of assignment is it really?
4. Are there missing details in the context?
5. What's the confidence level?

RESPOND WITH ONLY VALID JSON:
{
  "validatedAssignments": [
    {
      "originalId": "schedule_xxx",
      "isValid": true,
      "validation": {
        "confidence": 0.95,
        "realAssignment": true,
        "dateValidated": true,
        "typeConfirmed": true
      },
      "enhanced": {
        "text": "Clear, complete assignment description",
        "date": "2025-05-12",
        "type": "quiz|exam|assignment|activity|clinical",
        "hours": 1.5,
        "points": 35,
        "course": "${course}",
        "dueTime": "11:59PM",
        "confidence": 0.95
      },
      "changes": [
        "Fixed date from 'Monday May 12' to '2025-05-12'",
        "Added missing points value (35)",
        "Clarified assignment type as 'quiz'"
      ]
    }
  ],
  "invalidAssignments": [
    {
      "originalId": "schedule_xxx",
      "reason": "This is a section header, not an assignment",
      "evidence": "No action verb, no due date, appears to be descriptive text"
    }
  ],
  "missedAssignments": [
    {
      "text": "Assignment the regex parser missed",
      "date": "2025-06-02",
      "type": "quiz",
      "reason": "Found in context but not in regex results",
      "contextClue": "Line where this was found"
    }
  ],
  "summary": {
    "totalValidated": 43,
    "invalid": 2,
    "enhanced": 39,
    "missed": 4
  }
}`;

      const result = await this.makeRequest(prompt, {
        temperature: 0.1, // Very low for consistency
        taskType: 'comprehensive-validation',
        maxTokens: 20000 // Enough for full validation response
      });

      return this.applyValidationResults(regexResults, result);
      
    } catch (error) {
      console.error('❌ AI validation failed:', error);
      return {
        ...regexResults,
        validatedAssignments: [],
        validationError: error.message
      };
    }
  }

  applyValidationResults(regexResults, validationResult) {
    const enhancedAssignments = [];
    const validationMap = new Map();
    
    // Build validation map
    (validationResult.validatedAssignments || []).forEach(val => {
      validationMap.set(val.originalId, val);
    });
    
    // Process each regex assignment
    regexResults.assignments.forEach(assignment => {
      const validation = validationMap.get(assignment.id);
      
      if (validation && validation.isValid) {
        // Apply enhancements
        enhancedAssignments.push({
          ...assignment,
          ...validation.enhanced,
          id: assignment.id, // Preserve original ID
          source: 'regex-ai-validated',
          validation: validation.validation,
          enhancements: validation.changes,
          originalText: assignment.text // Keep original for reference
        });
      } else if (!validation || validation.isValid !== false) {
        // Keep unvalidated assignments (conservative approach)
        enhancedAssignments.push({
          ...assignment,
          validation: { validated: false, reason: 'Not processed by AI' }
        });
      }
      // Skip explicitly invalid assignments
    });
    
    // Add any missed assignments found by AI
    if (validationResult.missedAssignments) {
      validationResult.missedAssignments.forEach((missed, idx) => {
        enhancedAssignments.push({
          id: `ai_found_${Date.now()}_${idx}`,
          ...missed,
          source: 'ai-discovered',
          confidence: 0.8
        });
      });
    }
    
    return {
      assignments: enhancedAssignments,
      modules: regexResults.modules,
      events: regexResults.events,
      metadata: {
        ...regexResults.metadata,
        validation: validationResult.summary,
        validatedCount: enhancedAssignments.filter(a => a.validation?.confidence > 0.8).length,
        aiDiscovered: (validationResult.missedAssignments || []).length
      }
    };
  }

  // Remainder parsing with better context awareness
  async parseRemainingWithAI(remainingText, regexResults) {
    try {
      // Analyze what types of assignments were found to better identify what's missing
      const foundTypes = new Set(regexResults.assignments.map(a => a.type));
      const foundDates = new Set(regexResults.assignments.map(a => a.date).filter(Boolean));
      
      const prompt = `
You are analyzing text that remains after regex extraction. The regex found ${regexResults.assignments.length} assignments.

WHAT REGEX FOUND:
- Assignment types: ${Array.from(foundTypes).join(', ')}
- Date range: ${this.getDateRange(foundDates)}
- Total items: ${regexResults.assignments.length}

REMAINING TEXT TO ANALYZE:
${remainingText}

Look for assignments the regex missed:
1. Implicit tasks ("prepare for...", "review before class", "bring to clinical")
2. Assignments in narrative form
3. Prerequisites or prep work
4. Group activities or participation requirements
5. Any dates/deadlines mentioned without clear assignment text

CRITICAL: Do NOT re-extract these already found assignments:
${regexResults.assignments.map(a => `- ${a.text.substring(0, 50)}...`).join('\n')}

RESPOND WITH ONLY VALID JSON:
{
  "assignments": [
    {
      "text": "Complete assignment description",
      "date": "YYYY-MM-DD",
      "type": "prep|reading|activity|clinical-prep|participation",
      "hours": 1.0,
      "course": "${regexResults.assignments[0]?.course || 'unknown'}",
      "confidence": 0.7,
      "extractionContext": "Where/how this was found",
      "whyMissed": "Reason regex didn't catch this"
    }
  ],
  "analysisNotes": "Brief notes on what types of content remain"
}`;

      const result = await this.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'intelligent-remainder-parsing',
        maxTokens: 4000
      });

      return {
        assignments: (result.assignments || []).map((a, idx) => ({
          ...a,
          id: `ai_remainder_${Date.now()}_${idx}`,
          source: 'ai-remainder-analysis',
          hours: a.hours || 1.0
        })),
        analysisNotes: result.analysisNotes
      };
      
    } catch (error) {
      console.warn('⚠️ AI remainder parsing failed:', error.message);
      return { assignments: [], analysisNotes: 'Failed to analyze remainder' };
    }
  }

  getDateRange(dates) {
    const dateArray = Array.from(dates).filter(Boolean).sort();
    if (dateArray.length === 0) return 'No dates found';
    return `${dateArray[0]} to ${dateArray[dateArray.length - 1]}`;
  }

  // Final consolidation with duplicate detection
  async consolidateResults(regexEnhanced, aiRemainder, originalText) {
    const allAssignments = [
      ...(regexEnhanced.assignments || []),
      ...(aiRemainder.assignments || [])
    ];
    
    if (this.apiKey && allAssignments.length > 0) {
      try {
        const prompt = `
Final consolidation of ${allAssignments.length} assignments from multiple sources.

CONSOLIDATION RULES:
1. Identify true duplicates (same assignment, different wording)
2. Merge partial information from multiple sources
3. Resolve date/time conflicts
4. Ensure no double-counting
5. Maintain source attribution

ASSIGNMENTS TO CONSOLIDATE:
${JSON.stringify(allAssignments.map(a => ({
  id: a.id,
  text: a.text,
  date: a.date,
  type: a.type,
  source: a.source
})), null, 2)}

Create a final, deduplicated list with any necessary merges.

RESPOND WITH ONLY VALID JSON:
{
  "consolidatedAssignments": [...complete assignment objects...],
  "merges": [
    {
      "kept": "assignment_id",
      "removed": ["duplicate_id1", "duplicate_id2"],
      "reason": "Why these were merged"
    }
  ],
  "summary": "X assignments after consolidation (Y duplicates removed)"
}`;

        const result = await this.makeRequest(prompt, {
          temperature: 0.1,
          taskType: 'final-consolidation',
          maxTokens: 20000
        });

        return {
          assignments: result.consolidatedAssignments || allAssignments,
          metadata: {
            consolidation: {
              originalCount: allAssignments.length,
              finalCount: result.consolidatedAssignments?.length || allAssignments.length,
              merges: result.merges || [],
              summary: result.summary
            }
          }
        };
        
      } catch (error) {
        console.warn('⚠️ Consolidation failed, using simple dedup:', error);
      }
    }
    
    // Fallback to simple deduplication
    return {
      assignments: this.simpleDeduplication(allAssignments),
      metadata: {
        consolidation: {
          method: 'simple-deduplication',
          originalCount: allAssignments.length
        }
      }
    };
  }

  simpleDeduplication(assignments) {
    const seen = new Map();
    const deduplicated = [];
    
    assignments.forEach(assignment => {
      // Create a normalized key for comparison
      const key = this.createAssignmentKey(assignment);
      
      if (!seen.has(key)) {
        seen.set(key, assignment);
        deduplicated.push(assignment);
      } else {
        // Keep the version with more information
        const existing = seen.get(key);
        if (this.hasMoreInfo(assignment, existing)) {
          seen.set(key, assignment);
          const index = deduplicated.findIndex(a => a.id === existing.id);
          if (index !== -1) {
            deduplicated[index] = assignment;
          }
        }
      }
    });
    
    return deduplicated;
  }

  createAssignmentKey(assignment) {
    // Create a normalized key for deduplication
    const text = assignment.text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .slice(0, 5)
      .join(' ');
    
    const date = assignment.date || 'nodate';
    return `${text}_${date}`;
  }

  hasMoreInfo(assignment1, assignment2) {
    let score1 = 0, score2 = 0;
    
    if (assignment1.date) score1++;
    if (assignment2.date) score2++;
    
    if (assignment1.points) score1++;
    if (assignment2.points) score2++;
    
    if (assignment1.dueTime) score1++;
    if (assignment2.dueTime) score2++;
    
    if (assignment1.validation?.confidence > 0.8) score1 += 2;
    if (assignment2.validation?.confidence > 0.8) score2 += 2;
    
    return score1 > score2;
  }
}