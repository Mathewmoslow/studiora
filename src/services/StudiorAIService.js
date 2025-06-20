// src/services/StudiorAIService.js
// Studiora's AI Service - Sequential enhancement mode

export class StudiorAIService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.model = options.model || 'gpt-3.5-turbo';
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    this.timeout = options.timeout || 90000;
    this.maxRetries = options.maxRetries || 3;
  }

  // Sequential enhancement methods
  async parseRemaining(text, regexResults, options = {}) {
    const prompt = this.buildPrompt(text, 'parse-remaining', { regexResults });
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'parse-remaining',
        maxTokens: 3000
      });
      
      return this.validateAssignments(result.assignments || []);
    } catch (error) {
      console.error('🤖 AI parse remaining failed:', error);
      return { assignments: [] };
    }
  }

  async validateAndEnhance(text, regexResults, course, documentType) {
    const prompt = this.buildPrompt(text, 'validate-enhance', { 
      regexResults, 
      course, 
      documentType 
    });
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.1,
        taskType: 'validate-enhance',
        maxTokens: 4000
      });
      
      // Ensure proper structure
      return {
        validatedAssignments: this.validateAssignments(result.validatedAssignments || []),
        removedAssignments: result.removedAssignments || [],
        enhancementSummary: result.enhancementSummary || '',
        confidence: result.confidence || 0.8
      };
    } catch (error) {
      console.error('🤖 AI validation failed:', error);
      return {
        validatedAssignments: regexResults.assignments || [],
        removedAssignments: [],
        enhancementSummary: 'AI validation failed - returning original assignments',
        confidence: 0.5
      };
    }
  }

  async consolidate(enhancedRegex, aiRemainder, originalText) {
    const prompt = this.buildPrompt(originalText, 'final-consolidation', {
      enhancedRegex,
      aiRemainder
    });
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.1,
        taskType: 'final-consolidation',
        maxTokens: 4000
      });
      
      return {
        consolidatedAssignments: this.validateAssignments(result.consolidatedAssignments || []),
        duplicatesRemoved: result.duplicatesRemoved || 0,
        consolidationSummary: result.consolidationSummary || ''
      };
    } catch (error) {
      console.error('🤖 AI consolidation failed:', error);
      throw error;
    }
  }

  // Helper methods
  async makeRequest(prompt, options = {}) {
    const { temperature = 0.3, taskType = 'unknown', maxTokens = 4000 } = options;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: 'You are Studiora\'s AI assistant, specializing in parsing nursing education documents. Always respond with valid JSON.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API error: ${response.status} - ${error}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        try {
          const parsed = JSON.parse(content);
          console.log(`✅ Studiora AI ${taskType} successful`);
          return parsed;
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          throw new Error(`Invalid JSON response: ${parseError.message}`);
        }
        
      } catch (error) {
        console.error(`🤖 Studiora AI attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        await this.delay(attempt * 1000);
      }
    }
  }

  validateAssignments(assignments) {
    return assignments
      .filter(a => a && a.text && a.date)
      .map(assignment => ({
        ...assignment,
        id: assignment.id || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: assignment.text.trim(),
        date: this.validateDate(assignment.date),
        type: assignment.type || 'assignment',
        hours: Math.max(0.25, Math.min(8, assignment.hours || 1.5)),
        course: assignment.course || 'unknown',
        confidence: Math.max(0.1, Math.min(1, assignment.confidence || 0.7)),
        source: assignment.source || 'ai'
      }));
  }

  buildPrompt(text, taskType, context = {}) {
    const currentDate = this.getCurrentDateString();
    const basePrompt = `Current date: ${currentDate}
Academic semester: Spring 2025 (May 5 - August 10, 2025)
Document type: ${context.documentType || 'mixed'}
Course: ${context.course || 'nursing'}

IMPORTANT: You must return ONLY valid JSON with no additional text or formatting.`;

    switch (taskType) {
      case 'parse-remaining':
        return `${basePrompt}

Analyze this remaining text after regex extraction. Find ANY assignments missed by regex.
Focus on implicit assignments like "prepare for discussion", "review before class", etc.

REGEX ALREADY FOUND:
${JSON.stringify(context.regexResults?.assignments || [], null, 2)}

REMAINING TEXT TO ANALYZE:
${text}

Return JSON with this EXACT structure:
{
  "assignments": [
    {
      "text": "assignment description",
      "date": "YYYY-MM-DD",
      "type": "assignment|reading|quiz|exam|project|clinical|lab|discussion",
      "hours": 1.5,
      "confidence": 0.7,
      "extractionReason": "why this is an assignment"
    }
  ]
}`;

      case 'validate-enhance':
        return `${basePrompt}

VALIDATE and ENHANCE these regex-extracted assignments. For EACH assignment:
- Verify it's a real assignment (not a false positive)
- Find missing dates by looking at surrounding context
- Improve descriptions using context
- Fix any date parsing issues

ORIGINAL TEXT:
${text}

REGEX ASSIGNMENTS TO VALIDATE:
${JSON.stringify(context.regexResults?.assignments || [], null, 2)}

Return JSON with this EXACT structure:
{
  "validatedAssignments": [
    {
      "id": "keep original id",
      "text": "enhanced description",
      "date": "YYYY-MM-DD",
      "type": "assignment type",
      "hours": 1.5,
      "course": "${context.course || 'unknown'}",
      "confidence": 0.9,
      "validationNote": "why valid/what was fixed"
    }
  ],
  "removedAssignments": ["ids of false positives"],
  "enhancementSummary": "brief summary of changes",
  "confidence": 0.85
}`;

      case 'final-consolidation':
        return `${basePrompt}

CONSOLIDATE all assignments from enhanced regex and AI remainder parsing.
- Merge the two lists
- Remove any duplicates (same assignment found by both)
- Ensure consistent formatting
- Order by date

ENHANCED REGEX ASSIGNMENTS:
${JSON.stringify(context.enhancedRegex?.validatedAssignments || [], null, 2)}

AI REMAINDER ASSIGNMENTS:
${JSON.stringify(context.aiRemainder?.assignments || [], null, 2)}

Return JSON with this EXACT structure:
{
  "consolidatedAssignments": [
    {
      "id": "original or new id",
      "text": "assignment description",
      "date": "YYYY-MM-DD",
      "type": "type",
      "hours": 1.5,
      "course": "course",
      "confidence": 0.8,
      "source": "regex/ai/both",
      "consolidationNote": "unique/duplicate removed/merged"
    }
  ],
  "duplicatesRemoved": 0,
  "consolidationSummary": "X total assignments: Y from regex, Z from AI, W duplicates removed"
}`;

      default:
        return basePrompt;
    }
  }

  validateDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      // Ensure date is within reasonable academic bounds
      const minDate = new Date('2025-01-01');
      const maxDate = new Date('2025-12-31');
      
      if (date < minDate || date > maxDate) return null;
      
      // Fixed: Use local timezone instead of UTC
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return null;
    }
  }

  getCurrentDateString() {
    const now = new Date();
    // Fixed: Use local timezone instead of UTC
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ===== COMMENTED OUT DUAL PARSER METHODS =====
  // Original methods for independent parsing and reconciliation
  
  async parseIndependently(text, template, options = {}) {
    const { onProgress } = options;
    
    onProgress?.({ stage: 'ai-analyze', message: 'AI analyzing document structure...' });

    const prompt = this.buildIndependentParsingPrompt(text, template);
    
    try {
      onProgress?.({ stage: 'ai-extract', message: 'AI extracting assignments and dates...' });
      
      const result = await this.makeRequest(prompt, {
        temperature: 0.3,
        taskType: 'independent-parsing',
        maxTokens: 4000
      });

      onProgress?.({ stage: 'ai-complete', message: 'AI parsing complete' });
      
      return this.validateAndEnhanceAIResult(result);
      
    } catch (error) {
      console.error('🤖 Studiora AI parsing failed:', error);
      throw new Error(`AI parsing failed: ${error.message}`);
    }
  }

  async reconcileResults(reconciliationData, options = {}) {
    const { onProgress } = options;
    
    onProgress?.({ stage: 'ai-reconcile', message: 'AI analyzing differences...' });

    const prompt = this.buildReconciliationPrompt(reconciliationData);
    
    try {
      const result = await this.makeRequest(prompt, {
        temperature: 0.1,
        taskType: 'reconciliation',
        maxTokens: 4000
      });

      onProgress?.({ stage: 'reconcile-complete', message: 'Reconciliation complete' });
      
      return this.validateReconciliationResult(result);
      
    } catch (error) {
      console.error('🔄 Studiora reconciliation failed:', error);
      throw new Error(`Reconciliation failed: ${error.message}`);
    }
  }

  buildIndependentParsingPrompt(text, template) {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `You are Studiora's AI parser, specializing in nursing education content. Parse this document INDEPENDENTLY and COMPREHENSIVELY.

DOCUMENT TO PARSE:
${text}

CONTEXT:
- Current date: ${currentDate}
- Academic semester: Spring 2025 (May 5 - August 10, 2025)
- Template hint: ${template}
- Domain: Nursing education (OB/GYN, Adult Health, NCLEX prep, Gerontology)

EXTRACTION REQUIREMENTS:
1. ALL assignments (explicit and implicit)
   - Readings, quizzes, exams, projects, discussions, labs, clinical prep
   - Include "come prepared to discuss", "review before class", etc.
   - Homework, worksheets, case studies, simulations
   
2. ALL dates (convert relative to absolute)
   - "next week" → specific date
   - "Friday" → specific Friday date  
   - "by end of week" → Friday of that week
   - "before class" → day before class meeting
   
3. Course/module structure
   - Module numbers and titles
   - Week organization
   - Course codes (NURS, NSG, etc.)
   
4. Educational context
   - Learning objectives
   - Prerequisites
   - Study recommendations
   - Workload warnings

NURSING-SPECIFIC PATTERNS:
- Clinical rotations and prep requirements
- NCLEX/HESI exam preparations
- Skills lab assignments
- Case study discussions
- Medication calculation practice
- Simulation scenarios

RESPOND WITH ONLY VALID JSON (no markdown, no code blocks, no extra text):
{
  "assignments": [
    {
      "text": "Complete assignment description",
      "date": "YYYY-MM-DD",
      "type": "reading|quiz|exam|assignment|lab|discussion|clinical|simulation|prep",
      "hours": 1.5,
      "course": "obgyn|adulthealth|nclex|geronto|unknown",
      "confidence": 0.95,
      "extractionReason": "Why this was identified as an assignment"
    }
  ],
  "modules": [
    {
      "number": 1,
      "title": "Module title",
      "course": "course_code", 
      "chapters": "Chapter information",
      "keyTopics": "Key learning topics",
      "classMeeting": "Meeting schedule"
    }
  ],
  "events": [
    {
      "title": "Event name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "type": "lecture|clinical|exam|simulation|lab"
    }
  ],
  "learningObjectives": {
    "module1": ["objective1", "objective2"]
  },
  "studyHints": [
    {
      "assignment": "Assignment name",
      "hints": ["hint1", "hint2"],
      "timeRecommendation": "Start X days early"
    }
  ],
  "workloadWarnings": [
    {
      "week": "Week X",
      "reason": "Heavy workload description",
      "recommendation": "How to manage"
    }
  ],
  "overallConfidence": 0.88
}`;
  }

  buildReconciliationPrompt(data) {
    return `You are Studiora's reconciliation AI. Two independent parsers analyzed the same document. Your task is to create the most accurate, complete final result.

ORIGINAL DOCUMENT:
${data.originalText}

REGEX PARSER RESULTS:
Confidence: ${data.regexResults.confidence}
Assignments found: ${data.regexResults.assignments.length}
${JSON.stringify(data.regexResults.assignments, null, 2)}

AI PARSER RESULTS:  
Confidence: ${data.aiResults.confidence}
Assignments found: ${data.aiResults.assignments.length}
${JSON.stringify(data.aiResults.assignments, null, 2)}

RECONCILIATION TASKS:
1. MATCH assignments that are the same (despite different wording)
2. IDENTIFY unique assignments found by only one parser
3. RESOLVE conflicts (same assignment, different details)
4. DETERMINE the most accurate version for each item
5. CALCULATE final confidence based on agreement

MATCHING CRITERIA:
- Similar text content (accounting for abbreviations)
- Same due dates or logically related dates
- Same assignment type and purpose
- Consider that one parser might be more complete

CONFLICT RESOLUTION:
- Prefer specific dates over vague dates
- Prefer complete descriptions over abbreviated ones
- Trust AI for context and implications
- Trust regex for structured patterns
- When in doubt, include both if genuinely different

RESPOND WITH ONLY VALID JSON (no markdown, no code blocks, no extra text):
{
  "matches": [
    {
      "regexAssignment": {...},
      "aiAssignment": {...},
      "resolved": {
        "text": "Final assignment text",
        "date": "YYYY-MM-DD",
        "type": "assignment_type",
        "hours": 1.5,
        "course": "course_code",
        "confidence": 0.95
      },
      "winnerSource": "ai|regex|merged",
      "reasoning": "Why this resolution was chosen"
    }
  ],
  "regexUnique": [
    {
      "assignment": {...},
      "keepReason": "Why this should be kept",
      "confidence": 0.8
    }
  ],
  "aiUnique": [
    {
      "assignment": {...},
      "keepReason": "Why this should be kept",
      "confidence": 0.9
    }
  ],
  "conflicts": [
    {
      "issue": "Description of conflict",
      "regexVersion": {...},
      "aiVersion": {...},
      "resolution": {...},
      "reasoning": "Resolution explanation"
    }
  ],
  "finalConfidence": 0.92,
  "reconciliationSummary": "Found X matches, Y regex-unique, Z ai-unique, W conflicts resolved"
}`;
  }

  validateAndEnhanceAIResult(result) {
    // Ensure required fields exist
    result.assignments = result.assignments || [];
    result.modules = result.modules || [];
    result.events = result.events || [];
    result.learningObjectives = result.learningObjectives || {};
    result.studyHints = result.studyHints || [];
    result.workloadWarnings = result.workloadWarnings || [];
    result.overallConfidence = result.overallConfidence || 0.5;

    // Validate and fix assignments
    result.assignments = result.assignments.map(assignment => ({
      text: assignment.text || 'Unknown assignment',
      date: this.validateDate(assignment.date),
      type: assignment.type || 'assignment',
      hours: Math.max(0.25, Math.min(8, assignment.hours || 1.5)),
      course: assignment.course || 'unknown',
      confidence: Math.max(0.1, Math.min(1, assignment.confidence || 0.7)),
      extractionReason: assignment.extractionReason || 'AI identified',
      id: assignment.id || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));

    return result;
  }

  validateReconciliationResult(result) {
    result.matches = result.matches || [];
    result.regexUnique = result.regexUnique || [];
    result.aiUnique = result.aiUnique || [];
    result.conflicts = result.conflicts || [];
    result.finalConfidence = Math.max(0.1, Math.min(1, result.finalConfidence || 0.7));
    result.reconciliationSummary = result.reconciliationSummary || 'Reconciliation completed';

    return result;
  }
  ===== END COMMENTED DUAL PARSER METHODS ===== */
}

export default StudiorAIService;